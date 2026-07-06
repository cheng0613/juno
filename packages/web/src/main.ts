import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('./views/ChatView.vue'),
    },
    {
      path: '/models',
      name: 'models',
      component: () => import('./views/ModelsView.vue'),
    },
  ],
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')