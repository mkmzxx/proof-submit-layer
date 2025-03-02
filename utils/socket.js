import axios from "axios";
import chalk from "chalk";
import { Wallet } from "ethers";
import log from "./logger.js";
import { newAgent, readFile, saveJson, readJson, saveToFile } from "./helper.js";

const delay = async (s) => await new Promise((resolves) => setTimeout(resolves, s * 1000));
class LayerEdgeConnection {
  constructor(proxy = null, privateKey = null, refCode = "cvIwhX0T", localStorage, tasks) {
    this.refCode = refCode;
    this.proxy = proxy;
    this.localStorage = localStorage;
    this.tasks = tasks;
    this.axiosConfig = {
      ...(this.proxy && { httpsAgent: newAgent(this.proxy) }),
      timeout: 60000,
    };

    this.wallet = privateKey ? new Wallet(privateKey) : Wallet.createRandom();
  }

  getWallet() {
    return this.wallet;
  }

  async makeRequest(method, url, config = {}, retries = 20) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios({
          method,
          url,
          headers: {
            Accept: "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            Origin: "https://dashboard.layeredge.io",
            Referer: "https://dashboard.layeredge.io/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
          ...this.axiosConfig,
          ...config,
        });
        return response;
      } catch (error) {
        if (error?.response?.status === 404 || error?.status === 404) {
          log.error(`Layer Edge connection failed wallet not registered yet...`);
          return 404;
        }
        if (error?.response?.status === 400) {
          log.error(`Invalid param for request ${url}...`);
          return 400;
        } else if (error.response?.status === 409 && url.startsWith("https://referralapi.layeredge.io/api/task")) {
          return error.response.data;
        } else if (error.response?.status === 429) {
          log.error(chalk.red(`Layer Edge rate limit exceeded...`));
          await delay(60);
          continue;
        } else if (i === retries - 1) {
          log.error(`Max retries reached - Request failed:`, error.message);
          if (this.proxy) {
            log.error(`Failed proxy: ${this.proxy}`, error.message);
          }
          return null;
        }

        process.stdout.write(chalk.yellow(`request failed: ${error.message} => Retrying... (${i + 1}/${retries})\r`));
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    return null;
  }

  async checkInvite() {
    const inviteData = {
      invite_code: this.refCode,
    };

    const response = await this.makeRequest("post", "https://referralapi.layeredge.io/api/referral/verify-referral-code", { data: inviteData });

    if (response && response.data && response.data.data.valid === true) {
      log.info("Invite Code Valid", response.data);
      return true;
    } else {
      log.error("Failed to check invite");
      return false;
    }
  }

  async registerWallet() {
    const registerData = {
      walletAddress: this.wallet.address,
    };

    const response = await this.makeRequest("post", `https://referralapi.layeredge.io/api/referral/register-wallet/${this.refCode}`, { data: registerData });

    if (response && response.data) {
      log.info("Wallet successfully registered", response.data);
      return true;
    } else {
      log.error("Failed To Register wallets", "error");
      return false;
    }
  }

  async connectNode() {
    const timestamp = Date.now();
    const message = `Node activation request for ${this.wallet.address} at ${timestamp}`;
    const sign = await this.wallet.signMessage(message);

    const dataSign = {
      sign: sign,
      timestamp: timestamp,
    };

    const response = await this.makeRequest("post", `https://referralapi.layeredge.io/api/light-node/node-action/${this.wallet.address}/start`, { data: dataSign });

    if (response && response.data && response.data.message === "node action executed successfully") {
      log.info("Connected Node Successfully", response.data);
      return true;
    } else {
      log.warn("Failed to connect Node");
      return false;
    }
  }

  async checkProof(task) {
    const response = await this.makeRequest("get", `https://dashboard.layeredge.io/api/proofs/status?address=${this.wallet.address}`);
    // console.log(response.data);
    if (response && response.data) {
      if (response.data.hasSubmitted === false) {
        return await this.submitProof(task);
      } else if (response.data.isCardGenerated === false) {
        await this.generateCard();
      } else {
        return await this.doTask(task);
      }
      return task.id;
    }
    return false;
  }

  async generateCard() {
    const response = await this.makeRequest("post", `https://staging-referralapi.layeredge.io/api/card/shareable-card`, {
      data: {
        walletAddress: this.wallet.address,
      },
    });
    if (response && response.data) {
      log.info("Generate card success: ", response.data);
      return true;
    } else {
      log.error("Failed to generate card");
      return false;
    }
  }

  async submitProof(task) {
    const timestamp = new Date();
    const message = `I am submitting a proof for LayerEdge at ${timestamp}`;
    const sign = await this.wallet.signMessage(message);
    const dataSign = {
      message: message,
      signature: sign,
      address: this.wallet.address,
      proof: this.wallet.address,
    };
    const response = await this.makeRequest("post", `https://dashboard.layeredge.io/api/send-proof`, { data: dataSign });
    if (response && response.data && response.data.message?.includes("successfully")) {
      log.info("Submit Proof Success: ", response.data);
      await this.generateCard();
      return await this.doTask(task);
    } else {
      log.warn("Failed to submit proof");
      return false;
    }
  }

  async handleTasks() {
    for (const task of this.tasks) {
      await delay(1);
      const tasksCompleted = this.localStorage[this.wallet.address]?.tasks || [];
      if (tasksCompleted.includes(task.id)) {
        continue;
      }
      if (task.id === "proof-submission") {
        return await this.checkProof(task);
      } else {
        return this.doTask(task);
      }
    }
  }

  async doTask(task) {
    const timestamp = Date.now();
    const message = `${task.message} ${this.wallet.address} at ${timestamp}`;
    const sign = await this.wallet.signMessage(message);
    const dataSign = {
      sign: sign,
      timestamp: timestamp,
      walletAddress: this.wallet.address,
    };
    const response = await this.makeRequest("post", `https://referralapi.layeredge.io/api/task/${task.id}`, { data: dataSign });
    if (response && response.data && response.data.message?.includes("successfully")) {
      log.info(`Completed Task ${task.title} Successfully`, response.data);
      await saveJson(this.localStorage, this.wallet.address, task.id, "localStorage.json");
      return task.id;
    } else {
      log.warn(`Failed to Completed Task ${task.title}`, response);
      if (response.message?.includes("already completed")) {
        await saveJson(this.localStorage, this.wallet.address, task.id, "localStorage.json");
        return task.id;
      }
      return false;
    }
  }

  async stopNode() {
    const timestamp = Date.now();
    const message = `Node deactivation request for ${this.wallet.address} at ${timestamp}`;
    const sign = await this.wallet.signMessage(message);

    const dataSign = {
      sign: sign,
      timestamp: timestamp,
    };

    const response = await this.makeRequest("post", `https://referralapi.layeredge.io/api/light-node/node-action/${this.wallet.address}/stop`, { data: dataSign });

    if (response && response.data) {
      log.info("Stop and Claim Points Result:", response.data);
      return true;
    } else {
      log.warn("Failed to Stopping Node and claiming points");
      return false;
    }
  }

  async checkNodeStatus() {
    const response = await this.makeRequest("get", `https://referralapi.layeredge.io/api/light-node/node-status/${this.wallet.address}`);

    if (response === 404) {
      log.info("Node not found in this wallet, trying to regitering wallet...");
      await this.registerWallet();
      return false;
    }

    if (response && response.data && response.data.data.startTimestamp !== null) {
      log.info("Node Status Running", response.data);
      return true;
    } else {
      log.warn("Node not running trying to start node...");
      return false;
    }
  }

  async checkNodePoints() {
    const response = await this.makeRequest("get", `https://referralapi.layeredge.io/api/referral/wallet-details/${this.wallet.address}`);

    if (response && response.data) {
      log.info(`${this.wallet.address} Total Points:`, response.data.data?.nodePoints || 0);
      const lasCheckin = response.data.data?.lastClaimed;
      const isNewDate = new Date() - new Date(lasCheckin) > 24 * 60 * 60 * 1000;
      if (isNewDate || !lasCheckin) {
        await this.checkIn();
      }
      return true;
    } else {
      log.error("Failed to check Total Points..");
      return false;
    }
  }

  async checkIn() {
    const timestamp = Date.now();
    const message = `I am claiming my daily node point for ${this.wallet.address} at ${timestamp}`;
    const sign = await this.wallet.signMessage(message);

    const dataSign = {
      sign: sign,
      timestamp: timestamp,
      walletAddress: this.wallet.address,
    };
    const response = await this.makeRequest("post", `https://referralapi.layeredge.io/api/light-node/claim-node-points`, { data: dataSign });
    if (response && response.data) {
      log.info(`${this.wallet.address} Checkin success:`, response.data);
      return true;
    } else {
      log.error("Failed to check in..");
      return false;
    }
  }
}

export default LayerEdgeConnection;
