const axios = require('axios');
const bsv = require('bsv');
const secp256k1 = require('secp256k1');
const crypto = require('crypto');
const Run = require('run-sdk');
const { asm } = Run.extra;

const run = new Run({
    owner: '',
    purse: '',
    network: 'test',
    trust: '*',
    timeout: 60000
});

// constants
const { Opcode, Transaction } = bsv;
const privKey = run.owner.bsvPrivateKey;
const pubKey = privKey.toPublicKey().toBuffer();
const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
const signSigType = Buffer.from(sigtype.toString(16), 'hex');
const flags = bsv.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA | bsv.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | bsv.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | bsv.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES;

var count = 0;

class MagicLock {
    constructor(txHash, magicNumber) {
        this.txHash = txHash;
        this.magicNumber = magicNumber;
    }
    script() {
        return asm(`${this.txHash} ${this.magicNumber} OP_SIZE OP_4 OP_PICK OP_SHA256 OP_SWAP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_DROP OP_CHECKSIG`);
    }
    domain() { return 212 }
}
MagicLock.deps = { asm }
MagicLock.metadata = { emoji: '🧙' }
MagicLock.presets = {
    test: {
      origin: '6f3d4060765abb10e8a02247eb6ed7285bbc61642e987d685c5a88cc2b5595ea_o1',
      location: '6f3d4060765abb10e8a02247eb6ed7285bbc61642e987d685c5a88cc2b5595ea_o1',
      nonce: 1,
      owner: 'mvY9wtq9S9CHgH81EvSZeMSuF8RviFt8Nt',
      satoshis: 0
    }
}

const sha256 = data => { return crypto.createHash('sha256').update(data).digest('hex') }

const is21e8Out = script => {
    return !!(
        script.chunks.length === 12 &&
        script.chunks[0].buf &&
        script.chunks[0].buf.length === 32 &&
        script.chunks[1].buf &&
        script.chunks[1].buf.length >= 1 &&
        script.chunks[2].opcodenum === Opcode.OP_SIZE &&
        script.chunks[3].opcodenum === Opcode.OP_4 &&
        script.chunks[4].opcodenum === Opcode.OP_PICK &&
        script.chunks[5].opcodenum === Opcode.OP_SHA256 &&
        script.chunks[6].opcodenum === Opcode.OP_SWAP &&
        script.chunks[7].opcodenum === Opcode.OP_SPLIT &&
        script.chunks[8].opcodenum === Opcode.OP_DROP &&
        script.chunks[9].opcodenum === Opcode.OP_EQUALVERIFY &&
        script.chunks[10].opcodenum === Opcode.OP_DROP &&
        script.chunks[11].opcodenum === Opcode.OP_CHECKSIG
    );
}

const signSolution = (hashbuf, target = '') => {
    let randomK = crypto.randomBytes(32); // generate randomK for each sign attempt
    const signOptions = { data: randomK }; // assign randomK value to signOptions object
    const sig = secp256k1.signatureExport(secp256k1.signatureNormalize(secp256k1.ecdsaSign(hashbuf, privKey.toBuffer(), signOptions).signature)); // sign w/ randomK
    count++;
    if (target != '') {
        const sig256 = sha256(Buffer.concat([sig, signSigType]));
        if (!sig256.startsWith(target)) {
            if (count % 1000 === 0) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                process.stdout.write(count.toString());
                console.log(` ${sig256}`);
            } 
            return [false, false];
        } 
        else {
            return [sig, privKey, sig256];
        }
    }
    return [sig, privKey];
}

class MagicLockOwner {
    constructor(hash, target) {
        this.hash = hash;
        this.target = target;
    }
    nextOwner() {
        return new MagicLock(this.hash, this.target);
    }
    async sign(rawtx, parents, locks) {
        const tx = Transaction(rawtx);
        console.log(parents)
        tx.inputs.forEach((input, n) => {
            if (locks[n] && locks[n].constructor.name === 'MagicLock') {
                const sighash = Transaction.sighash.sighash(tx, sigtype, n, parents[n].script, new bsv.crypto.BN(parents[n].satoshis), flags).reverse();
                let sig, privKey, sig256;
                while (!sig) {
                    [sig, privKey, sig256] = signSolution(sighash, this.target);
                }
                let unlockingScript = new bsv.Script({});
                unlockingScript.add(Buffer.concat([sig, Buffer.from([sigtype & 0xff])])).add(pubKey);
                input.setScript(unlockingScript);
            }
        })
        return tx.toString('hex');
    }
}

const mine = async(from, index, to) => {
    const targetScript = bsv.Script.fromHex(from.vout[index].scriptPubKey.hex);
    const hash = targetScript.toASM().split(' ')[0];
    const target = targetScript.toASM().split(' ')[1];
    run.owner = new MagicLockOwner(hash, target);
    const minedJig = await run.load(`${from.hash}_o${index}`);
    minedJig.send(to);
    await minedJig.sync();
    return minedJig;
}

const start = async(location) => {
    const txid = location.slice(0, 64);
    const index = parseInt(location.slice(-1));
    try {
      let tx;
      try {
        const { data } = await axios.get(`https://api.whatsonchain.com/v1/bsv/test/tx/hash/${txid}`);
        tx = data;
      } catch(e) { throw("TX not found.") }

      if (!is21e8Out(bsv.Script.fromHex(tx.vout[index].scriptPubKey.hex))) { throw `No 21e8 output found at location ${index}.` }

      try { bsv.Address.fromString(run.owner.address) }
      catch(e){ throw("Invalid address") }

      console.log(`Mining TX ${txid} output ${index}`);
      console.log(`Sending Jigs to: ${run.owner.address}`);

      let res = await mine(tx, index, run.owner.address);
      console.log({res});
    } catch(e){ console.log(e) }
}
start('');