use crate::types;
use crate::webhook::invoice_caller::InvoiceHook;
use anyhow::Result;
use dashmap::{DashMap, DashSet};
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use tokio::sync::broadcast::{Receiver, Sender, channel};

const CHANNEL_CAPACITY: usize = 265;

#[derive(Debug, Clone)]
pub struct OfferSubscriptions {
    all_offers: Arc<DashSet<u64>>,
    offer_subscriptions: Arc<DashMap<u64, DashSet<u64>>>,

    invoice_request_tx: Sender<InvoiceHook<types::False>>,
    invoice_response_tx: Sender<(u64, String)>,
}

impl OfferSubscriptions {
    pub fn new() -> Self {
        Self {
            all_offers: Arc::new(DashSet::new()),
            offer_subscriptions: Arc::new(DashMap::new()),
            invoice_request_tx: channel::<InvoiceHook<types::False>>(CHANNEL_CAPACITY).0,
            invoice_response_tx: channel::<(u64, String)>(CHANNEL_CAPACITY).0,
        }
    }

    pub fn subscribe_invoice_requests(&self) -> Receiver<InvoiceHook<types::False>> {
        self.invoice_request_tx.subscribe()
    }

    pub fn subscribe_invoice_responses(&self) -> Receiver<(u64, String)> {
        self.invoice_response_tx.subscribe()
    }

    pub fn connection_id_known(&self, connection_id: u64) -> bool {
        self.offer_subscriptions.contains_key(&connection_id)
    }

    pub fn request_invoice(&self, offer: &str, hook: InvoiceHook<types::False>) -> Result<bool> {
        if !self.all_offers.contains(&Self::hash_offer(offer)) {
            return Ok(false);
        }

        self.invoice_request_tx.send(hook)?;
        Ok(true)
    }

    pub fn received_invoice_response(&self, hook_id: u64, invoice: String) {
        self.invoice_response_tx.send((hook_id, invoice));
    }

    pub fn offers_subscribed(&self, connection_id: u64, offers: &[String]) {
        let existing_for_id = self.offer_subscriptions.entry(connection_id).or_default();

        for offer in offers {
            let id = Self::hash_offer(offer);
            existing_for_id.insert(id);
            self.all_offers.insert(id);
        }
    }

    pub fn connection_dropped(&self, connection_id: u64) {
        if let Some((_, ids)) = self.offer_subscriptions.remove(&connection_id) {
            self.all_offers.retain(|id| !ids.contains(id));
        }
    }

    fn hash_offer(offer: &str) -> u64 {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        offer.to_lowercase().hash(&mut hasher);
        hasher.finish()
    }
}
