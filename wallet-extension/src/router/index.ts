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
    {
      path: "/add-wallet",
      name: "add-wallet",
      component: () => import("../views/AddWalletView.vue"),
    },
    {
      path: "/send",
      name: "send",
      component: () => import("../views/SendView.vue"),
    },
    {
      path: "/transaction/:txId",
      name: "transaction-details",
      component: () => import("../views/TransactionDetailsView.vue"),
    },
    {
      path: "/account/:index",
      name: "account-details",
      component: () => import("../views/AccountDetailsView.vue"),
    },
    {
      path: "/manage-tokens",
      name: "manage-tokens",
      component: () => import("../views/ManageTokensView.vue"),
    },
  ],
});

export default router;
