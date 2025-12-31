type Account = {
  index: number;
  path: string;
  stxAddress: string;
  btcP2PKHAddress: string;
  btcP2TRAddress: string;
  pubkey: string;
};

type JsonRpcRequest = {
  jsonrpc: string;
  id: string;
  method: string;
  params: any;
};

type Result = {
  method: string;
  status: string;
  data: Object;
};

export type { Account, JsonRpcRequest, Result };
