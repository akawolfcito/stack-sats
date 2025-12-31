import { createRouter, createWebHashHistory } from "vue-router";
import StartView from "@/views/StartView.vue";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "start",
      component: StartView,
    },
    {
      path: "/unlock",
      name: "unlock",
      component: () => import("../views/UnlockView.vue"),
    },
    {
      path: "/user",
      name: "user",
      component: () => import("../views/UserHomeView.vue"),
    },
    {
      path: "/usermenu",
      name: "usermenu",
      component: () => import("../views/UserMenu.vue"),
    },
  ],
});

export default router;
