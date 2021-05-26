# Magic Miner

## Introduction

This script is a customized [21e8 miner](https://github.com/deanmlittle/21e8miner) to mine tokens and Jigs on the RUN protocol.

The miner uses your CPU to unlock instances of the [MagicLock](https://run.network/explorer/?query=4d27151e192c676fde34c45c0d61abb08e578b049bba07b8eebacbeb0185ecf3_o1&network=main) class or a magic number script.

## Clone via GitHub

To install, clone via:

```
git clone https://github.com/jdh7190/magicminer.git
```

## Getting Started

Once cloned, execute the following commands:

```
npm install
```

## Configuration

In unlock.js add your purse and owner keys in the RUN instance:

```javascript
const run = new Run({
    owner: '',
    purse: '',
    network: 'test',
    trust: '*',
    timeout: 60000
});
```

## Mining

Specify the location, for example:

```
abc95bcf6d3379b8ce46ef8dcd8b8bcc16a5127c1503439500aad93a6eabc5a3_o1
```

of the tokens or jig you want to mine as the parameter in the ```start()``` function, then run the command:

```
npm start
```

Node.js will start mining against the locking script and once successful will send the tokens or jig to the address tied to your owner private key.

## Presets

By default, the miner is configured on testnet. To change to mainnet, change the ```network``` of the RUN instance to ```main```:

```javascript
const run = new Run({
    owner: '',
    purse: '',
    network: 'main',
    trust: '*',
    timeout: 60000
});
```

Also change the ```MagicLock``` presets to:

```javascript
MagicLock.presets = {
    main: {
      origin: '4d27151e192c676fde34c45c0d61abb08e578b049bba07b8eebacbeb0185ecf3_o1',
      location: '4d27151e192c676fde34c45c0d61abb08e578b049bba07b8eebacbeb0185ecf3_o1',
      nonce: 1,
      owner: '17xS4DEeJprSMhqgb5J4CcYezybMY8ptMP',
      satoshis: 0
    }
}
```