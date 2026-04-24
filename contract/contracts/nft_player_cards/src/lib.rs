#![no_std]

use common::errors::ContractError;
use common::idempotency::{cleanup_operation, ensure_not_replayed, is_operation_executed};
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, Map, Symbol, String, Vec, symbol_short};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    TokenOwner(BytesN<32>),
    TokenUri(BytesN<32>),
    RoyaltyRecipients(BytesN<32>),
    RoyaltyShares(BytesN<32>),
    OwnerTokens(Address),
}

#[contracttype]
#[derive(Clone)]
pub struct PlayerCardEvent {
    pub token_id: BytesN<32>,
    pub to: Address,
    pub token_uri: String,
    pub nft_contract: Address,
    pub timestamp: u64,
    pub action: Symbol,
    pub price: Option<i128>,
}

pub const PLAYER_CARD_EVENT: Symbol = symbol_short!("PC_EVENT");

#[contract]
pub struct NFTPlayerCards;

#[contractimpl]
impl NFTPlayerCards {
    pub fn register_player(
        env: Env,
        token_id: BytesN<32>,
        metadata_uri: String,
    ) -> Result<(), ContractError> {
        if token_exists(&env, &token_id) {
            return Err(ContractError::TokenAlreadyExists);
        }

        let owner = env.invoker();
        set_owner(&env, &token_id, &owner);
        set_token_uri(&env, &token_id, &metadata_uri);
        emit_event(&env, &token_id, &owner, &metadata_uri, Symbol::short("REGISTER"), None);
        Ok(())
    }

    pub fn mint(
        env: Env,
        operation_hash: BytesN<32>,
        to: Address,
        token_id: BytesN<32>,
        metadata_uri: String,
        ttl_seconds: Option<u64>,
    ) -> Result<(), ContractError> {
        ensure_not_replayed(
            &env,
            Symbol::new(&env, "nft_mint"),
            operation_hash.clone(),
            ttl_seconds,
        )?;

        if token_exists(&env, &token_id) {
            return Err(ContractError::TokenAlreadyExists);
        }

        set_owner(&env, &token_id, &to);
        set_token_uri(&env, &token_id, &metadata_uri);
        emit_event(&env, &token_id, &to, &metadata_uri, Symbol::short("MINT"), None);
        Ok(())
    }

    pub fn is_mint_operation_executed(
        env: Env,
        operation_hash: BytesN<32>,
    ) -> bool {
        is_operation_executed(&env, Symbol::new(&env, "nft_mint"), operation_hash)
    }

    pub fn cleanup_mint_operation(
        env: Env,
        operation_hash: BytesN<32>,
    ) -> bool {
        cleanup_operation(&env, Symbol::new(&env, "nft_mint"), operation_hash)
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: BytesN<32>,
    ) -> Result<(), ContractError> {
        from.require_auth();

        let current_owner = get_owner(&env, &token_id)
            .ok_or(ContractError::TokenNotFound)?;
        if current_owner != from {
            return Err(ContractError::NotTokenOwner);
        }

        set_owner(&env, &token_id, &to);
        let uri = get_token_uri(&env, &token_id).unwrap_or(String::from_str(&env, ""));
        emit_event(&env, &token_id, &to, &uri, Symbol::short("TRANSFER"), None);
        Ok(())
    }

    pub fn burn(
        env: Env,
        owner: Address,
        token_id: BytesN<32>,
    ) -> Result<(), ContractError> {
        owner.require_auth();

        let current_owner = get_owner(&env, &token_id)
            .ok_or(ContractError::TokenNotFound)?;
        if current_owner != owner {
            return Err(ContractError::NotTokenOwner);
        }

        remove_owner(&env, &token_id);
        remove_token_uri(&env, &token_id);
        remove_royalty_info(&env, &token_id);

        emit_event(&env, &token_id, &owner, &String::from_str(&env, ""), Symbol::short("BURN"), None);
        Ok(())
    }

    pub fn token_uri(
        env: Env,
        token_id: BytesN<32>,
    ) -> Option<String> {
        get_token_uri(&env, &token_id)
    }

    pub fn get_player(
        env: Env,
        token_id: BytesN<32>,
    ) -> Option<String> {
        get_token_uri(&env, &token_id)
    }

    pub fn get_owner(
        env: Env,
        token_id: BytesN<32>,
    ) -> Option<Address> {
        get_owner(&env, &token_id)
    }

    pub fn set_royalty(
        env: Env,
        owner: Address,
        token_id: BytesN<32>,
        recipients: Vec<Address>,
        shares: Vec<u32>,
    ) -> Result<(), ContractError> {
        owner.require_auth();
        let current_owner = get_owner(&env, &token_id)
            .ok_or(ContractError::TokenNotFound)?;
        if current_owner != owner {
            return Err(ContractError::NotTokenOwner);
        }

        if recipients.len() != shares.len() {
            return Err(ContractError::InvalidRoyaltyConfiguration);
        }

        let mut total_shares: u32 = 0;
        for share in shares.iter() {
            total_shares = total_shares.saturating_add(*share);
            if total_shares > 10_000 {
                return Err(ContractError::InvalidRoyaltyConfiguration);
            }
        }

        env.storage()
            .instance()
            .set(&DataKey::RoyaltyRecipients(token_id.clone()), &recipients);
        env.storage()
            .instance()
            .set(&DataKey::RoyaltyShares(token_id.clone()), &shares);

        Ok(())
    }

    pub fn get_royalty_info(
        env: Env,
        token_id: BytesN<32>,
    ) -> (Vec<Address>, Vec<u32>) {
        let recipients: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::RoyaltyRecipients(token_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        let shares: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::RoyaltyShares(token_id.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        (recipients, shares)
    }

    pub fn marketplace_sale(
        env: Env,
        operation_hash: BytesN<32>,
        buyer: Address,
        payment_token: Address,
        token_id: BytesN<32>,
        sale_price: i128,
        ttl_seconds: Option<u64>,
    ) -> Result<(), ContractError> {
        buyer.require_auth();

        if sale_price <= 0 {
            return Err(ContractError::InvalidSalePrice);
        }

        ensure_not_replayed(
            &env,
            Symbol::new(&env, "marketplace_sale"),
            operation_hash.clone(),
            ttl_seconds,
        )?;

        let seller = get_owner(&env, &token_id).ok_or(ContractError::TokenNotFound)?;
        let (recipients, shares) = self::get_royalty_info(env.clone(), token_id.clone());

        let token_client = token::Client::new(&env, &payment_token);
        let mut total_royalty_amount: i128 = 0;
        let mut total_shares: u32 = 0;
        for share in shares.iter() {
            total_shares = total_shares.saturating_add(*share);
            if total_shares > 10_000 {
                return Err(ContractError::InvalidRoyaltyConfiguration);
            }
        }

        for (recipient, share) in recipients.iter().zip(shares.iter()) {
            let amount = sale_price.saturating_mul(*share as i128) / 10_000;
            if amount > 0 {
                token_client.transfer(&buyer, recipient, &amount);
                total_royalty_amount = total_royalty_amount.saturating_add(amount);
            }
        }

        let seller_amount = sale_price.saturating_sub(total_royalty_amount);
        if seller_amount < 0 {
            return Err(ContractError::InvalidSalePrice);
        }

        token_client.transfer(&buyer, &seller, &seller_amount);
        set_owner(&env, &token_id, &buyer);

        let uri = get_token_uri(&env, &token_id).unwrap_or(String::from_str(&env, ""));
        emit_event(&env, &token_id, &buyer, &uri, Symbol::short("SALE"), Some(sale_price));
        Ok(())
    }
}

fn token_exists(env: &Env, token_id: &BytesN<32>) -> bool {
    env.storage().instance().has(&DataKey::TokenOwner(token_id.clone()))
}

fn get_owner(env: &Env, token_id: &BytesN<32>) -> Option<Address> {
    env.storage().instance().get(&DataKey::TokenOwner(token_id.clone()))
}

fn set_owner(env: &Env, token_id: &BytesN<32>, owner: &Address) {
    let key = DataKey::TokenOwner(token_id.clone());
    if let Some(previous_owner) = env.storage().instance().get::<_, Address>(&key) {
        remove_token_from_owner(env, &previous_owner, token_id);
    }

    env.storage().instance().set(&key, owner);
    add_token_to_owner(env, owner, token_id);
}

fn remove_owner(env: &Env, token_id: &BytesN<32>) {
    let key = DataKey::TokenOwner(token_id.clone());
    if let Some(owner) = env.storage().instance().get::<_, Address>(&key) {
        remove_token_from_owner(env, &owner, token_id);
    }
    env.storage().instance().remove(&key);
}

fn get_token_uri(env: &Env, token_id: &BytesN<32>) -> Option<String> {
    env.storage().instance().get(&DataKey::TokenUri(token_id.clone()))
}

fn set_token_uri(env: &Env, token_id: &BytesN<32>, token_uri: &String) {
    env.storage()
        .instance()
        .set(&DataKey::TokenUri(token_id.clone()), token_uri);
}

fn remove_token_uri(env: &Env, token_id: &BytesN<32>) {
    env.storage().instance().remove(&DataKey::TokenUri(token_id.clone()));
}

fn remove_royalty_info(env: &Env, token_id: &BytesN<32>) {
    env.storage()
        .instance()
        .remove(&DataKey::RoyaltyRecipients(token_id.clone()));
    env.storage()
        .instance()
        .remove(&DataKey::RoyaltyShares(token_id.clone()));
}

fn get_tokens_of_owner(env: &Env, owner: Address) -> Vec<BytesN<32>> {
    env.storage()
        .instance()
        .get(&DataKey::OwnerTokens(owner))
        .unwrap_or_else(|| Vec::new(env))
}

fn add_token_to_owner(env: &Env, owner: &Address, token_id: &BytesN<32>) {
    let key = DataKey::OwnerTokens(owner.clone());
    let mut tokens = get_tokens_of_owner(env, owner.clone());
    tokens.push_back(token_id.clone());
    env.storage().instance().set(&key, &tokens);
}

fn remove_token_from_owner(env: &Env, owner: &Address, token_id: &BytesN<32>) {
    let key = DataKey::OwnerTokens(owner.clone());
    let mut tokens = get_tokens_of_owner(env, owner.clone());
    if let Some(index) = tokens.iter().position(|id| id == token_id) {
        tokens.remove(index as u32);
        env.storage().instance().set(&key, &tokens);
    }
}

fn emit_event(
    env: &Env,
    token_id: &BytesN<32>,
    to: &Address,
    token_uri: &String,
    action: Symbol,
    price: Option<i128>,
) {
    let event = PlayerCardEvent {
        token_id: token_id.clone(),
        to: to.clone(),
        token_uri: token_uri.clone(),
        nft_contract: env.current_contract_address(),
        timestamp: env.ledger().timestamp(),
        action,
        price,
    };
    env.events().publish((PLAYER_CARD_EVENT,), event);
}
