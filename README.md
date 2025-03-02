# proof-submit-layer
# Layer Edge Auto Ping Node and auto proof submite

- website : https://dashboard.layeredge.io/

## Features

- **Auto Run Node**
- **Auto Create Accounts**
- **Auto Referrall**
- **Support Proxy usage**
- **Auto Claim Points every hour**
**Auto proof submite and auto task**

## Prerequisites

- Node.js installed on your machine


## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/mkmzxx/proof-submit-layer
    cd proof-submit-layer
    ```

2. Install the required dependencies:
    ```sh
    npm install
    ```
3. paste proxy in `proxy.txt`:
-  format `http://username:password@ip:port` or `socks5://username:password@ip:port`
    ```sh
    nano proxy.txt
    ```
4. Enter your wallets in `wallets.json`:
format `[
  {
    "address": "your wallets address ",
    "privateKey": "enter your privateKey"
  },
  {
    "address": "your wallets address ",
    "privateKey": "enter your privateKey"
  }
]`
/ 
    ```sh
    wallets.json
    ```
4. Run the script:
    ```sh
    node main.js



4. Auto Referral / create new wallets
    ```sh
    node autoref.js
    ```



## All wallets information saved at `wallets.json`


## ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

This project is licensed under the [MIT License](LICENSE).
