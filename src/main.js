import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import PlaylistViewer from './views/PlaylistViewer.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/playlist/:id', component: PlaylistViewer, props: true }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app') 