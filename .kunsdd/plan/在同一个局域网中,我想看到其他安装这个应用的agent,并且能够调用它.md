# LAN 局域网 Agent 发现与远程调用

## 概述

在 NestJS 服务端添加 mDNS 局域网发现 + 远程 Agent 调用功能，让同一局域网内的 Juno 实例能互相发现，并通过 HTTP+SSE 跨节点调用彼此的 AI Agent。

**前置条件**：LAN 功能依赖 `@juno/server` 运行。Tauri 桌面模式下需同时启动服务端（`pnpm dev:server`），后续可考虑 Rust 侧轻量替代。

---

## Step 1: 共享类型 — `@juno/shared`

在 `packages/shared/src/types.ts` 中追加：

```typescript
// ── LAN 发现 ──
export interface LanPeer {
  id: string           // UUID（每启动唯一）
  hostname: string
  displayName: string
  address: string      // IP
  port: number
  version: string
  status: 'online' | 'busy'
  lastSeen: number
}

// ── 远程调用 ──
export interface RemoteChatRequest {
  peerId: string
  message: string
  images?: { type: 'image'; data: string; mimeType: string }[]
  streamingBehavior?: 'steer' | 'followUp'
}

export interface RemoteChatEvent {
  type: string
  peerId: string
  data: unknown
}
```

---

## Step 2: 服务端依赖 — `@juno/server`

在 `packages/server/package.json` 追加：

- `multicast-dns` — mDNS 广播与发现（\~18KB，纯 JS，零 C++ 编译）
- `@types/multicast-dns` — devDependencies（可选）

---

## Step 3: 服务端 — `LanModule`（新模块）

新建 `packages/server/src/lan/` 目录，内部文件：

### 3a. `lan.module.ts`

```typescript
@Module({
  controllers: [LanController],
  providers: [LanDiscoveryService, LanRemoteService],
  exports: [LanDiscoveryService, LanRemoteService],
})
export class LanModule {}
```

注册到 `app.module.ts` 的 `imports`。

### 3b. `lan-discovery.service.ts` — mDNS 发现服务

`LanDiscoveryService implements OnModuleInit, OnModuleDestroy`

**职责**：

- `onModuleInit()`:
  - 读取 `.juno/agent/settings.json` 中的 `lanDiscovery.enabled` 开关（默认 `false`）
  - 若开启，创建 mDNS 实例，广播 `_juno._tcp` 服务
  - 创建 mDNS 浏览器，监听 `_juno._tcp` 响应
  - 维护 `peers: Map<string, LanPeer>`，定期（每 5s）发送 mDNS 查询
  - 每个 peer 超过 15s 未刷新标记为 offline
- `onModuleDestroy()`: 销毁 mDNS 实例，停止广播
- 暴露 `getPeers(): LanPeer[]`
- 暴露 `events: Subject<{ type: 'peer_added' | 'peer_removed' | 'peer_updated'; peer: LanPeer }>`

**TXT 记录**：

```
txt: [
  `id=${uuid}`,
  `name=${os.hostname()}`,
  `version=${pkg.version}`,
  `port=${port}`,
]
```

### 3c. `lan-remote.service.ts` — 远程调用服务

`LanRemoteService`

**职责**：

- `remoteChat(peerId, prompt)`:
  - 从 `LanDiscoveryService` 找到 peer 的 `address:port`
  - 发起 `POST http://{address}:{port}/api/lan/chat` 带 SSE 流式响应
  - 读取 SSE 事件，转换成 `RemoteChatEvent` 通过 Subject 发出
  - 本地 `PiGateway` 转发这些事件到本地的 Socket.IO `/chat` 命名空间
- `getLocalEndpoint(): { address, port }` — 返回本机 LAN IP + 端口

**本地 IP 获取**：使用 `os.networkInterfaces()` 找到非 127.0.0.1 的 IPv4 地址。

### 3d. `lan.controller.ts` — REST 端点

挂载到 `/api/lan`：


| 方法   | 路径                      | 用途                                |
| ---- | ----------------------- | --------------------------------- |
| GET  | `/api/lan/peers`        | 获取发现的 peer 列表                     |
| GET  | `/api/lan/status`       | 本机 LAN 信息（address, port, enabled） |
| PUT  | `/api/lan/settings`     | 开启/关闭 LAN 发现（写入 settings.json）    |
| POST | `/api/lan/chat`         | 接收远程 peer 的聊天请求（SSE 流返回）          |
| POST | `/api/lan/chat/:peerId` | 向指定 peer 发送聊天请求（触发远程调用）           |


**`POST /api/lan/chat`**（被远程调用时）：

- 接收 `{ message, images?, streamingBehavior? }`
- 调用 `PiService.prompt()`
- 通过 SSE（`text/event-stream`）将 `PiService` 的事件流返回给调用方
- 每个事件格式：`event: message\n` + `data: { ... }\n\n`

**`POST /api/lan/chat/:peerId`**（发起远程调用时）：

- 接收 `{ message, images?, streamingBehavior? }`
- 调用 `LanRemoteService.remoteChat()`
- 返回 SSE 流给前端

### 3e. `lan.gateway.ts`（可选增强）

WebSocket 命名空间 `/lan`，推送 peer 增删事件给前端。如果前端用轮询则不需要。

---

## Step 4: 前端 — LAN Peers Store

新建 `packages/web/src/stores/lanPeers.ts`

```typescript
export const useLanPeersStore = defineStore('lanPeers', () => {
  const peers = ref<LanPeer[]>([])
  const enabled = ref(false)
  const localInfo = ref<{ address: string; port: number } | null>(null)

  async function fetchPeers() {
    peers.value = await api.getLanPeers()
  }

  async function fetchStatus() {
    const status = await api.getLanStatus()
    enabled.value = status.enabled
    localInfo.value = { address: status.address, port: status.port }
  }

  async function setEnabled(val: boolean) {
    await api.setLanEnabled(val)
    enabled.value = val
  }

  // 轮询（每 10s）或通过 WebSocket 接收事件
  function startPolling() { ... }
  function stopPolling() { ... }

  return { peers, enabled, localInfo, fetchPeers, fetchStatus, setEnabled, startPolling, stopPolling }
})
```

在 `httpClient.ts` 追加 API 方法：

```typescript
getLanPeers: () => request<LanPeer[]>('/lan/peers'),
getLanStatus: () => request<{ enabled: boolean; address: string; port: number }>('/lan/status'),
setLanEnabled: (enabled: boolean) => request('/lan/settings', { method: 'PUT', body: JSON.stringify({ enabled }) }),
remoteChat: (peerId: string, body: { message: string; images?: any[] }) => {
  // SSE 流请求
},
```

---

## Step 5: 前端 — 远程会话状态（扩展 `session.ts` store）

在 `session.ts` 中追加：

- `remoteChat(peerId, message, images)` — 标记当前会话为远程模式，调用 `POST /api/lan/chat/:peerId`，通过 EventSource/SSE 接收事件，直接喂入 `handleEvent()`
- `isRemote: boolean` — 当前是否为远程会话
- `remotePeerId: string | null` — 当前连接的远程 peer

**事件流转**：远程 SSE 返回的事件格式与本地的 WS 事件一致，所以 `handleEvent()` 可直接复用。

---

## Step 6: 前端 — UI 组件

### 6a. `LanPeersPanel.vue`（在 `components/lan/` 下）

嵌入到 `DetailPanel.vue` 作为新栏目 "Network"，或在 `AppSidebar` 底部新增。

**内容**：

- 开关：开启/关闭 LAN 发现
- 本机信息：`192.168.1.x:8000`
- Peer 列表：每个 peer 显示 hostname、status 圆点、IP、点击可发起对话
- "Invoke" 按钮 → 选中 peer 后，`ChatView` 切换为远程模式

### 6b. 修改 `ChatView.vue`

- 当 `sessionStore.isRemote` 为 true 时：
  - 聊天输入框显示 `🤖 远程: {peerHostname}`
  - 消息气泡上标注 `[remote: {peerHostname}]`
  - `handleSend()` 调用 `sessionStore.remoteChat()` 而非本地的 `sendPrompt()`
- 消息流标记：`MessageItem.vue` 可选 props `remoteLabel?: string` 显示远端标识

### 6c. 修改 `DetailPanel.vue`

在现有的 Agent 栏目下方新增 "Network" 栏目：

```vue
<!-- Network -->
<div class="rounded-lg border-none bg-muted/30">
  <button @click="toggleSection('network')">
    <Wifi class="h-3.5 w-3.5" /> Network
  </button>
  <div v-if="expandedSections.network">
    <!-- LAN toggle switch -->
    <!-- Local info -->
    <!-- Peer list with invoke buttons -->
  </div>
</div>
```

---

## Step 7: 配置持久化

在 `PiSettings` 类型中新增：

```typescript
lanDiscovery?: {
  enabled: boolean
}
```

服务端 `settings.json` 中持久化，通过 `SettingsManager` 或直接 JSON 文件读写。

**简化方案**：在 `~/.juno/agent/settings.json` 中新增 `lanDiscovery.enabled` 字段，`LanDiscoveryService` 直接读取。

---

## Step 8: 安全措施

- **默认关闭**：LAN 发现默认为 `false`，用户需主动开启
- **LAN 绑定**：仅监听 LAN IP（非 `0.0.0.0` 或 `127.0.0.1`）
- **白名单**（可选）：可配置允许调用的 peer ID 列表
- **最大调用次数**（可选）：防止滥用

---

## 文件变更清单


| 文件                                                   | 操作                                                   |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `packages/shared/src/types.ts`                       | 追加 `LanPeer`, `RemoteChatRequest`, `RemoteChatEvent` |
| `packages/server/package.json`                       | 追加 `multicast-dns` 依赖                                |
| `packages/server/src/app.module.ts`                  | Import `LanModule`                                   |
| `packages/server/src/lan/lan.module.ts`              | 新建                                                   |
| `packages/server/src/lan/lan-discovery.service.ts`   | 新建（核心：mDNS 发现）                                       |
| `packages/server/src/lan/lan-remote.service.ts`      | 新建（核心：远程请求+SSE）                                      |
| `packages/server/src/lan/lan.controller.ts`          | 新建                                                   |
| `packages/server/src/lan/lan.gateway.ts`             | 新建（可选，WS 事件推送）                                       |
| `packages/web/src/stores/lanPeers.ts`                | 新建                                                   |
| `packages/web/src/stores/session.ts`                 | 追加 `remoteChat()`, `isRemote`, `remotePeerId`        |
| `packages/web/src/api/httpClient.ts`                 | 追加 LAN API 方法                                        |
| `packages/web/src/api/socket.ts`                     | 追加 LAN WebSocket（如果使用）                               |
| `packages/web/src/components/lan/LanPeersPanel.vue`  | 新建                                                   |
| `packages/web/src/views/ChatView.vue`                | 追加远程模式                                               |
| `packages/web/src/components/layout/DetailPanel.vue` | 追加 Network 栏目                                        |


---

## 风险与考量

1. **Tauri 模式局限**：LAN 功能依赖 NestJS 服务端。Tauri-only 模式下无法使用。未来可考虑 Rust 侧添加轻量 HTTP 服务（`actix-web` 或 `tiny_http`）+ `libmdns` crate。
2. **跨网络兼容**：mDNS 仅在单广播域内有效（通常即同一 LAN / 同一 VLAN）。跨子网需网关配置。
3. **Windows Defender 防火墙**：Node.js 进程可能被阻止入站连接，用户需手动授权。
4. **SSE 流可靠性**：远程调用时如果 Agent 响应很长，SSE 连接需保持。可以设置 10 分钟超时。
5. **并发远程调用**：当前每个服务端只有一个 `PiService` 实例，单会话。远程调用时本机用户无法同时使用。需要锁或队列机制。

---

## 测试计划

1. **单元测试**：
  - `LanDiscoveryService` — mDNS 响应解析、peer 过期逻辑
  - `LanRemoteService` — SSE 事件解析与转发
  - `LanController` — 路由参数校验、错误响应
2. **集成测试**：
  - 启动两个 NestJS 实例（不同端口），验证 mDNS 发现对方
  - 从实例 A 发起到实例 B 的远程 chat，验证 SSE 流传输
3. **前端测试**：
  - `lanPeers` store 数据流（mock HTTP）
  - 远程模式下的消息渲染

