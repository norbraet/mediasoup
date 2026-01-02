import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// Import views
import JoinRoom from '@/views/JoinRoom.vue'
import ConferenceRoom from '@/views/ConferenceRoom.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/join'
  },
  {
    path: '/join',
    name: 'JoinRoom',
    component: JoinRoom,
    meta: {
      title: 'Join Meeting'
    }
  },
  {
    path: '/room/:roomId',
    name: 'ConferenceRoom', 
    component: ConferenceRoom,
    props: true,
    meta: {
      title: 'Conference Room'
    }
  },
  {
    // 404 fallback
    path: '/:pathMatch(.*)*',
    redirect: '/join'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Global navigation guard for page titles
router.beforeEach((to) => {
  const title = to.meta?.title as string
  if (title) {
    document.title = `${title} - Conference App`
  }
})

export default router
