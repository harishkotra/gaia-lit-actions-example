const { LitNodeClient } = require("@lit-protocol/lit-node-client");
const {
  LIT_NETWORK,
  LIT_RPC,
  LIT_ABILITY,
} = require("@lit-protocol/constants");
const {
  LitActionResource,
  LitPKPResource,
} = require("@lit-protocol/auth-helpers");
const { EthWalletProvider } = require("@lit-protocol/lit-auth-client");
const { LitContracts } = require("@lit-protocol/contracts-sdk");
const fs = require("fs");
const { ethers } = require("ethers");
require("dotenv").config();
const litActionCode = fs.readFileSync("litAction.js", "utf8");
// Get environment variables
const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY;
if (!ETHEREUM_PRIVATE_KEY) {
  throw new Error("ETHEREUM_PRIVATE_KEY not found in .env");
}

/**
 * Mints a new Programmable Key Pair (PKP) using the Lit Protocol
 */
const mintPkp = async (ethersSigner) => {
  try {
    const litContracts = new LitContracts({
      signer: ethersSigner,
      network: LIT_NETWORK.DatilDev,
    });
    await litContracts.connect();

    const mintTx = await litContracts.pkpNftContractUtils.write.mint();
    const pkp = mintTx.pkp;
    console.log(`✅ Minted new PKP: ${pkp.publicKey}`);
    return pkp;
  } catch (error) {
    console.error("Error minting PKP:", error);
    throw error;
  }
};

async function main() {
  let litNodeClient;

  try {
    // Initialize Ethereum wallet
    const ethersWallet = new ethers.Wallet(
      ETHEREUM_PRIVATE_KEY,
      new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
    );

    // Initialize and connect Lit Node Client
    litNodeClient = new LitNodeClient({
      litNetwork: LIT_NETWORK.DatilDev,
      debug: true,
    });
    await litNodeClient.connect();
    console.log("✅ Connected to Lit network");

    // Mint new PKP
    const pkpInfo = await mintPkp(ethersWallet);

    // Create authentication method
    const authMethod = await EthWalletProvider.authenticate({
      signer: ethersWallet,
      litNodeClient,
    });

    // Get session signatures
    const sessionSigs = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkpInfo.publicKey,
      chain: "ethereum",
      authMethods: [authMethod],
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
      resourceAbilityRequests: [
        {
          resource: new LitActionResource("*"),
          ability: LIT_ABILITY.LitActionExecution,
        },
        {
          resource: new LitPKPResource("*"),
          ability: LIT_ABILITY.PKPSigning,
        },
      ],
    });

    // Fetch current temperature from weather API
    const weatherResponse = await fetch(
      "https://api.weather.gov/gridpoints/TOP/31,80/forecast"
    );
    const weatherData = await weatherResponse.json();
    const currentTemp = weatherData.properties.periods[0].temperature;

    // Prepare the signing message
    const message = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`Temperature: ${currentTemp}°F`)
      )
    );

    // Execute Lit Action
    console.log("🔄 Executing Lit Action...");
    const response = await litNodeClient.executeJs({
      sessionSigs,
      code: litActionCode,
      jsParams: {
        temp: currentTemp,
        toSign: message,
        publicKey: pkpInfo.publicKey,
        sigName: "weatherCheck"
      }
    });

    console.log("✅ Execution complete");
    console.log("Lit Action Response:", response);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Ensure connection is closed
    if (litNodeClient) {
      litNodeClient.disconnect();
    }
  }
}

// Execute the application
main().catch(console.error);