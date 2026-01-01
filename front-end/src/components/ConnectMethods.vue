<script setup lang="ts">
import { inject, ref, type Ref } from "vue"
import { connect, disconnect, getLocalStorage, isConnected, request } from "@stacks/connect"
import Button from "./ui/Button.vue"

let isWalletConnected = inject("isWalletConnected") as Ref<boolean>

// Network state from wallet
interface WalletNetwork {
  name: string
  chainId: number
  client: { baseUrl: string }
}

const walletNetwork = ref<WalletNetwork | null>(null)
const walletAddress = ref<string>("")

// Fetch network info from wallet
async function fetchWalletNetwork() {
  try {
    const response = await request("getAddresses", {})
    console.log("Wallet getAddresses response:", response)

    if (response && response.network) {
      walletNetwork.value = response.network
      console.log("Wallet network:", walletNetwork.value)
    }

    // Get STX address
    if (response && response.addresses) {
      const stxAddr = response.addresses.find((a: { symbol: string }) => a.symbol === "STX")
      if (stxAddr) {
        walletAddress.value = stxAddr.address
      }
    }
  } catch (error) {
    console.error("Failed to fetch wallet network:", error)
  }
}

// Get network config - uses wallet network or falls back to Platform devnet
function getNetworkConfig() {
  if (walletNetwork.value) {
    // Use wallet's network
    return {
      chainId: walletNetwork.value.chainId,
      client: walletNetwork.value.client
    }
  }

  // Fallback to Platform devnet
  const platformDevnetUrl = `https://api.platform.hiro.so/v1/ext/${
    import.meta.env.VITE_PLATFORM_HIRO_API_KEY
  }/stacks-blockchain-api`

  return {
    chainId: 2147483648,
    client: { baseUrl: platformDevnetUrl }
  }
}

async function handleSignMessage() {
  const response = await request("stx_signMessage", {
    message: "Stacks Wallet rocks!"
  })
  console.log("stx_signMessage response:", response)
}

async function handleConnect() {
  const authRequest = await connect({
    enableLocalStorage: true
  })

  if (authRequest) {
    isWalletConnected.value = true
    // Fetch wallet network after connecting
    await fetchWalletNetwork()
  }
}

function handleGetLocalStorage() {
  const response = getLocalStorage()

  if (response) {
    console.log(response)
  } else {
    console.log("No wallet data found in local storage.")
  }
}

function handleIsConnected() {
  const response = isConnected()
  console.log(response)
}

async function handleCallContract() {
  const network = getNetworkConfig()
  console.log("Using network:", network)

  const response = await request("stx_callContract", {
    contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.counter",
    functionName: "increment",
    functionArgs: [],
    network
  })
  console.log("stx_callContract response:", response)
}

async function handleTransferStx() {
  const network = getNetworkConfig()
  console.log("Using network:", network)

  const response = await request("stx_transferStx", {
    recipient: "ST23SRWT9A0CYMPW4Q32D0D7KT2YY07PQAVJY3NJZ",
    amount: "1000000", // 1 STX
    memo: "Test transfer from Stack-SATs",
    network
  })
  console.log("stx_transferStx response:", response)
}

function handleDisconnect() {
  disconnect()
  isWalletConnected.value = false
  walletNetwork.value = null
  walletAddress.value = ""
}

function handleConsoleLog() {
  console.log("Available WBIP Providers:")
  // @ts-ignore
  console.log(window.wbip_providers!)
}

let methodsArray = [
  {
    name: "isConnected",
    description: "Checks if wallet is connected to app",
    function: handleIsConnected,
    link: "https://docs.hiro.so/stacks/connect/guides/authenticate-users#manage-authentication-state"
  },
  {
    name: "getLocalStorage",
    description: "Retrieves accounts stored in local storage",
    function: handleGetLocalStorage,
    link: "https://docs.hiro.so/stacks/connect/guides/authenticate-users#access-user-data"
  },
  {
    name: "stx_signMessage",
    description: "Signs a message with wallet account's private key",
    function: handleSignMessage,
    link: "https://docs.hiro.so/stacks/connect/guides/sign-messages#sign-messages"
  },
  {
    name: "stx_callContract",
    description: "Calls `.counter` contract's `increment` function",
    function: handleCallContract,
    link: "https://docs.hiro.so/stacks/connect/guides/broadcast-transactions#sign-and-broadcast-transactions"
  },
  {
    name: "stx_transferStx",
    description: "Transfers 1 STX to wallet_2 (devnet)",
    function: handleTransferStx,
    link: "https://docs.hiro.so/stacks/connect/guides/broadcast-transactions#sign-and-broadcast-transactions"
  },
  {
    name: "disconnect",
    description: "Disconnects wallet from app",
    function: handleDisconnect,
    link: "https://docs.hiro.so/stacks/connect/guides/authenticate-users#manage-authentication-state"
  }
]
</script>

<template>
  <template v-if="!isWalletConnected">
    <p>
      - Awesome! the Stacks wallet extension is enabled and has registered its
      <code
        ><a
          href="https://github.com/hirosystems/connect#wallet-implementation-guide"
          target="_blank"
          class="inline-link"
          >`StacksWallet`</a
        ></code
      >
      object provider to the global <code>`window`</code> object of this page.
    </p>
    <p>
      - Click <span class="inline-link" @click="handleConsoleLog">here</span> and check the
      browser console to see Stacks Wallet as an available
      <a href="https://wbips.netlify.app/" target="_blank" class="inline-link">WBIP Provider</a
      >.
    </p>
    <p>
      - Click the Stacks Wallet extension icon in the browser toolbar to open the extension
      popup and create a new wallet or import an existing 24 mnemonic word seed phrase. Best if
      you import one of the pre-funded wallets provided in the <code>Devnet.toml</code> file of
      your Clarinet project directory.
    </p>
    <p>
      - Go ahead and click 'connect' below to see Stacks Wallet appear as an option in the
      @stacks/connect modal UI.
    </p>
    <br />
    <button @click="handleConnect" v-if="!isWalletConnected">connect</button>
  </template>
  <template v-else>
    <!-- Network and Address Info -->
    <div class="wallet-info">
      <div class="info-row">
        <span class="label">Network:</span>
        <span class="network-badge" :class="walletNetwork?.name || 'unknown'">
          {{ walletNetwork?.name || 'Unknown' }}
        </span>
      </div>
      <div class="info-row" v-if="walletAddress">
        <span class="label">Address:</span>
        <code class="address">{{ walletAddress.slice(0, 8) }}...{{ walletAddress.slice(-6) }}</code>
      </div>
    </div>

    <p>
      - Your Stacks Wallet extension is now connected with this app. Go ahead and interact with
      it using the below @stacks/connect methods.
    </p>
    <p>
      - The dApp will use the network selected in your wallet: <strong>{{ walletNetwork?.name || 'Unknown' }}</strong>
    </p>
    <p>- Open up browser console to see responses.</p>
    <br />
    <Button
      v-for="(method, index) in methodsArray"
      :method="method.name"
      :description="method.description"
      :function="method.function"
      :link="method.link"
      :key="index"
    />
  </template>
</template>

<style scoped>
.wallet-info {
  background: rgba(100, 108, 255, 0.1);
  border: 1px solid rgba(100, 108, 255, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #888;
  font-size: 0.85rem;
}

.network-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
}

.network-badge.mainnet {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.network-badge.testnet {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.network-badge.devnet {
  background: rgba(100, 108, 255, 0.2);
  color: #646cff;
}

.network-badge.unknown {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

.address {
  font-size: 0.85rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
