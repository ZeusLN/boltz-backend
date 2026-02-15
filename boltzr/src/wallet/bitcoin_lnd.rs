use crate::lightning::lnd::Lnd;
use crate::wallet::keys::Keys;
use crate::wallet::{Network, Wallet};
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use bitcoin::{bip32::Xpriv, secp256k1};
use std::str::FromStr;
use tokio::sync::Mutex;

pub struct BitcoinLnd {
    network: bitcoin::Network,
    lnd: Mutex<Lnd>,
    keys: Keys,
}

impl BitcoinLnd {
    pub fn new(network: Network, seed: &[u8; 64], path: String, lnd: Lnd) -> Result<Self> {
        Ok(Self {
            network: match network {
                Network::Mainnet => bitcoin::Network::Bitcoin,
                Network::Testnet => bitcoin::Network::Testnet,
                Network::Signet => bitcoin::Network::Signet,
                Network::Regtest => bitcoin::Network::Regtest,
            },
            lnd: Mutex::new(lnd),
            keys: Keys::new(seed, path)?,
        })
    }
}

#[async_trait]
impl Wallet for BitcoinLnd {
    fn decode_address(&self, address: &str) -> Result<Vec<u8>> {
        let dec = bitcoin::address::Address::from_str(address)?;
        Ok(match dec.require_network(self.network) {
            Ok(address) => address.script_pubkey().into_bytes(),
            Err(_) => return Err(anyhow!("invalid network")),
        })
    }

    fn derive_keys(&self, index: u64) -> Result<Xpriv> {
        self.keys.derive_key(index)
    }

    fn derive_pubkey(
        &self,
        secp: &secp256k1::Secp256k1<secp256k1::All>,
        index: u64,
    ) -> Result<secp256k1::PublicKey> {
        Ok(self.derive_keys(index)?.private_key.public_key(secp))
    }

    fn derive_blinding_key(&self, _script_pubkey: Vec<u8>) -> Result<Vec<u8>> {
        Err(anyhow!("not implemented for bitcoin"))
    }

    async fn get_address(&self, _wallet: Option<&str>, _label: &str) -> Result<String> {
        self.lnd.lock().await.new_address().await
    }
}
