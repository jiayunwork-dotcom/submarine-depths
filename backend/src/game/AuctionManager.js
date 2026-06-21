const { v4: uuidv4 } = require('uuid');
const CONFIG = require('./config');

class AuctionManager {
  constructor(game) {
    this.game = game;
    this.listings = [];
    this.history = [];
    this.totalTaxCollected = 0;
    this.currentTurnTax = 0;
  }

  getItemConfig(itemType) {
    return CONFIG.AUCTION.ITEM_TYPES[itemType];
  }

  getPlayerActiveListings(playerId) {
    return this.listings.filter(l => l.sellerId === playerId && l.status === 'active');
  }

  getPlayerActiveBids(playerId) {
    return this.listings.filter(l => l.status === 'active' && l.highestBidderId === playerId);
  }

  createListing(playerId, itemType, quantity, startPrice, duration, buyNowEnabled = false, buyNowPrice = null) {
    const player = this.game.getPlayer(playerId);
    if (!player || player.isDefeated) {
      return { success: false, message: '玩家不存在或已被淘汰' };
    }

    const itemConfig = this.getItemConfig(itemType);
    if (!itemConfig) {
      return { success: false, message: '无效的物品类型' };
    }

    if (quantity < itemConfig.minQuantity) {
      return { success: false, message: `${itemConfig.name}最低${itemConfig.minQuantity}单位起拍` };
    }

    if (duration < CONFIG.AUCTION.MIN_DURATION || duration > CONFIG.AUCTION.MAX_DURATION) {
      return { success: false, message: `拍卖持续回合数必须在${CONFIG.AUCTION.MIN_DURATION}到${CONFIG.AUCTION.MAX_DURATION}之间` };
    }

    if (startPrice <= 0) {
      return { success: false, message: '起拍价必须大于0' };
    }

    if (buyNowEnabled) {
      if (!buyNowPrice || buyNowPrice <= 0) {
        return { success: false, message: '买断价格必须大于0' };
      }
      const minBuyNowPrice = startPrice * CONFIG.AUCTION.BUY_NOW_MIN_MULTIPLIER;
      if (buyNowPrice < minBuyNowPrice) {
        return { success: false, message: `买断价格必须不低于起拍价的${CONFIG.AUCTION.BUY_NOW_MIN_MULTIPLIER}倍（最低${minBuyNowPrice}矿物）` };
      }
    }

    const activeListings = this.getPlayerActiveListings(playerId);
    if (activeListings.length >= CONFIG.AUCTION.MAX_LISTINGS_PER_PLAYER) {
      return { success: false, message: `同一时间最多挂${CONFIG.AUCTION.MAX_LISTINGS_PER_PLAYER}件拍品` };
    }

    if (itemType === 'mineral') {
      if (player.base.storage.mineral < quantity) {
        return { success: false, message: '矿物不足' };
      }
      player.base.storage.mineral -= quantity;
    } else if (itemType === 'bio_sample') {
      if (player.base.storage.bio_sample < quantity) {
        return { success: false, message: '生物样本不足' };
      }
      player.base.storage.bio_sample -= quantity;
    } else if (itemType === 'techPoints') {
      if (player.base.techPoints < quantity) {
        return { success: false, message: '科技点不足' };
      }
      player.base.techPoints -= quantity;
    }

    const listing = {
      id: uuidv4(),
      sellerId: playerId,
      sellerName: player.name,
      itemType,
      itemName: itemConfig.name,
      itemIcon: itemConfig.icon,
      quantity,
      startPrice,
      currentPrice: startPrice,
      highestBidderId: null,
      highestBidderName: null,
      duration,
      remainingTurns: duration,
      createdTurn: this.game.turn,
      status: 'active',
      buyNowEnabled: !!buyNowEnabled,
      buyNowPrice: buyNowEnabled ? buyNowPrice : null
    };

    this.listings.push(listing);

    this.game.eventLog.push({
      type: 'auction_listed',
      listingId: listing.id,
      sellerId: playerId,
      sellerName: player.name,
      itemType,
      quantity,
      startPrice,
      duration,
      turn: this.game.turn,
      message: `${player.name} 在拍卖行挂牌出售 ${quantity} ${itemConfig.name}，起拍价 ${startPrice} 矿物，持续 ${duration} 回合`
    });

    return { success: true, listing };
  }

  placeBid(playerId, listingId, bidPrice) {
    const player = this.game.getPlayer(playerId);
    if (!player || player.isDefeated) {
      return { success: false, message: '玩家不存在或已被淘汰' };
    }

    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      return { success: false, message: '拍品不存在' };
    }

    if (listing.status !== 'active') {
      return { success: false, message: '该拍品已结束拍卖' };
    }

    if (listing.sellerId === playerId) {
      return { success: false, message: '不能对自己挂的拍品出价' };
    }

    const activeBids = this.getPlayerActiveBids(playerId);
    if (activeBids.length >= CONFIG.AUCTION.MAX_BIDS_PER_PLAYER) {
      return { success: false, message: `同一时间最多参与${CONFIG.AUCTION.MAX_BIDS_PER_PLAYER}件竞价` };
    }

    const minIncrement = Math.ceil(listing.startPrice * CONFIG.AUCTION.MIN_BID_INCREMENT_RATIO);
    const minBid = listing.currentPrice + minIncrement;

    if (listing.highestBidderId === null) {
      if (bidPrice < listing.startPrice) {
        return { success: false, message: `出价不能低于起拍价 ${listing.startPrice} 矿物` };
      }
    } else {
      if (bidPrice < minBid) {
        return { success: false, message: `每次加价不少于 ${minIncrement} 矿物，最低出价 ${minBid} 矿物` };
      }
    }

    if (player.base.storage.mineral < bidPrice) {
      return { success: false, message: '矿物不足' };
    }

    const previousBidderId = listing.highestBidderId;
    const previousBidPrice = listing.currentPrice;

    if (previousBidderId) {
      const previousBidder = this.game.getPlayer(previousBidderId);
      if (previousBidder) {
        previousBidder.base.storage.mineral += previousBidPrice;
      }
    }

    player.base.storage.mineral -= bidPrice;
    listing.highestBidderId = playerId;
    listing.highestBidderName = player.name;
    listing.currentPrice = bidPrice;

    if (previousBidderId) {
      const previousBidder = this.game.getPlayer(previousBidderId);
      this.game.eventLog.push({
        type: 'auction_outbid',
        listingId: listing.id,
        outbidPlayerId: previousBidderId,
        outbidPlayerName: previousBidder ? previousBidder.name : 'Unknown',
        newBidderId: playerId,
        newBidderName: player.name,
        newPrice: bidPrice,
        itemType: listing.itemType,
        quantity: listing.quantity,
        turn: this.game.turn,
        message: `${player.name} 以 ${bidPrice} 矿物超过 ${previousBidder ? previousBidder.name : 'Unknown'}，成为 ${listing.quantity} ${listing.itemName} 的最高出价者`
      });
    } else {
      this.game.eventLog.push({
        type: 'auction_bid',
        listingId: listing.id,
        bidderId: playerId,
        bidderName: player.name,
        price: bidPrice,
        itemType: listing.itemType,
        quantity: listing.quantity,
        turn: this.game.turn,
        message: `${player.name} 对 ${listing.quantity} ${listing.itemName} 出价 ${bidPrice} 矿物`
      });
    }

    return { success: true, listing };
  }

  cancelListing(playerId, listingId) {
    const player = this.game.getPlayer(playerId);
    if (!player || player.isDefeated) {
      return { success: false, message: '玩家不存在或已被淘汰' };
    }

    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      return { success: false, message: '拍品不存在' };
    }

    if (listing.sellerId !== playerId) {
      return { success: false, message: '只能取消自己挂的拍品' };
    }

    if (listing.status !== 'active') {
      return { success: false, message: '该拍品已结束拍卖' };
    }

    if (listing.highestBidderId !== null) {
      return { success: false, message: '已有玩家出价，无法取消' };
    }

    listing.status = 'cancelled';

    if (listing.itemType === 'mineral') {
      player.base.storage.mineral += listing.quantity;
    } else if (listing.itemType === 'bio_sample') {
      player.base.storage.bio_sample += listing.quantity;
    } else if (listing.itemType === 'techPoints') {
      player.base.techPoints += listing.quantity;
    }

    this.game.eventLog.push({
      type: 'auction_cancelled',
      listingId: listing.id,
      sellerId: playerId,
      sellerName: player.name,
      itemType: listing.itemType,
      quantity: listing.quantity,
      turn: this.game.turn,
      message: `${player.name} 取消了 ${listing.quantity} ${listing.itemName} 的拍卖`
    });

    return { success: true };
  }

  buyNow(playerId, listingId) {
    const player = this.game.getPlayer(playerId);
    if (!player || player.isDefeated) {
      return { success: false, message: '玩家不存在或已被淘汰' };
    }

    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      return { success: false, message: '拍品不存在' };
    }

    if (listing.status !== 'active') {
      return { success: false, message: '该拍品已结束拍卖' };
    }

    if (!listing.buyNowEnabled) {
      return { success: false, message: '该拍品不支持一口价买断' };
    }

    if (listing.sellerId === playerId) {
      return { success: false, message: '不能买断自己挂的拍品' };
    }

    if (player.base.storage.mineral < listing.buyNowPrice) {
      return { success: false, message: '矿物不足' };
    }

    if (listing.highestBidderId) {
      const previousBidder = this.game.getPlayer(listing.highestBidderId);
      if (previousBidder) {
        previousBidder.base.storage.mineral += listing.currentPrice;
      }
    }

    player.base.storage.mineral -= listing.buyNowPrice;

    listing.highestBidderId = playerId;
    listing.highestBidderName = player.name;
    listing.finalBuyType = 'buy_now';

    this.settleAuction(listing, listing.buyNowPrice, playerId, player.name);

    this.game.eventLog.push({
      type: 'auction_buy_now',
      listingId: listing.id,
      buyerId: playerId,
      buyerName: player.name,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      itemType: listing.itemType,
      quantity: listing.quantity,
      buyNowPrice: listing.buyNowPrice,
      turn: this.game.turn,
      message: `${player.name} 以 ${listing.buyNowPrice} 矿物一口价买断了 ${listing.sellerName} 的 ${listing.quantity} ${listing.itemName}`
    });

    return { success: true, listing };
  }

  processTurnEnd() {
    const expiredListings = [];

    for (const listing of this.listings) {
      if (listing.status !== 'active') continue;

      listing.remainingTurns -= 1;

      if (listing.remainingTurns <= 0) {
        expiredListings.push(listing);
      }
    }

    for (const listing of expiredListings) {
      this.settleAuction(listing);
    }

    if (this.currentTurnTax > 0) {
      this.distributeTax();
      this.currentTurnTax = 0;
    }
  }

  distributeTax() {
    const alivePlayers = this.game.players.filter(p => !p.isDefeated && p.base);
    if (alivePlayers.length === 0) return;

    const taxPerPlayer = Math.floor(this.currentTurnTax / alivePlayers.length);
    if (taxPerPlayer <= 0) return;

    for (const player of alivePlayers) {
      player.base.storage.mineral += taxPerPlayer;
    }

    this.game.eventLog.push({
      type: 'auction_tax_distributed',
      totalTax: this.currentTurnTax,
      taxPerPlayer,
      playerCount: alivePlayers.length,
      turn: this.game.turn,
      message: `拍卖行本回合收取税金 ${this.currentTurnTax} 矿物，平均分配给 ${alivePlayers.length} 位存活玩家，每人获得 ${taxPerPlayer} 矿物`
    });
  }

  settleAuction(listing, finalPrice = null, buyerId = null, buyerName = null) {
    listing.status = 'settled';
    listing.settledTurn = this.game.turn;

    const seller = this.game.getPlayer(listing.sellerId);
    const price = finalPrice !== null ? finalPrice : listing.currentPrice;
    const finalBuyerId = buyerId !== null ? buyerId : listing.highestBidderId;
    const finalBuyerName = buyerName !== null ? buyerName : listing.highestBidderName;
    const buyer = finalBuyerId ? this.game.getPlayer(finalBuyerId) : null;

    if (finalBuyerId === null) {
      listing.finalStatus = 'flow';

      if (seller) {
        if (listing.itemType === 'mineral') {
          seller.base.storage.mineral += listing.quantity;
        } else if (listing.itemType === 'bio_sample') {
          seller.base.storage.bio_sample += listing.quantity;
        } else if (listing.itemType === 'techPoints') {
          seller.base.techPoints += listing.quantity;
        }
      }

      this.game.eventLog.push({
        type: 'auction_flow',
        listingId: listing.id,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        itemType: listing.itemType,
        quantity: listing.quantity,
        turn: this.game.turn,
        message: `${listing.sellerName} 的 ${listing.quantity} ${listing.itemName} 拍卖流拍，物品已返还`
      });
    } else {
      listing.finalStatus = 'sold';
      listing.finalPrice = price;
      listing.finalBuyerId = finalBuyerId;
      listing.finalBuyerName = finalBuyerName;

      const tax = Math.floor(price * CONFIG.AUCTION.TAX_RATE);
      const sellerReceives = price - tax;
      listing.taxCollected = tax;
      listing.sellerReceives = sellerReceives;

      this.totalTaxCollected += tax;
      this.currentTurnTax += tax;

      if (seller) {
        seller.base.storage.mineral += sellerReceives;
      }

      if (buyer) {
        if (listing.itemType === 'mineral') {
          buyer.base.storage.mineral += listing.quantity;
        } else if (listing.itemType === 'bio_sample') {
          buyer.base.storage.bio_sample += listing.quantity;
        } else if (listing.itemType === 'techPoints') {
          buyer.base.techPoints += listing.quantity;
        }
      }

      this.game.eventLog.push({
        type: 'auction_sold',
        listingId: listing.id,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        buyerId: finalBuyerId,
        buyerName: finalBuyerName,
        itemType: listing.itemType,
        quantity: listing.quantity,
        finalPrice: price,
        tax,
        sellerReceives,
        turn: this.game.turn,
        message: `${finalBuyerName} 以 ${price} 矿物拍下了 ${listing.sellerName} 的 ${listing.quantity} ${listing.itemName}（税金${tax}矿物，卖家实得${sellerReceives}矿物）`
      });
    }

    this.history.unshift({ ...listing });
    if (this.history.length > CONFIG.AUCTION.HISTORY_LIMIT) {
      this.history = this.history.slice(0, CONFIG.AUCTION.HISTORY_LIMIT);
    }
    this.listings = this.listings.filter(l => l.id !== listing.id);
  }

  getActiveListings() {
    return this.listings.filter(l => l.status === 'active');
  }

  getHistory() {
    return this.history.slice(0, CONFIG.AUCTION.HISTORY_LIMIT);
  }

  getPlayerListings(playerId) {
    const active = this.listings.filter(l => l.sellerId === playerId && l.status === 'active');
    const history = this.history.filter(l => l.sellerId === playerId);
    return [...active, ...history];
  }

  historyToPublicState(listing) {
    return {
      id: listing.id,
      itemType: listing.itemType,
      itemName: listing.itemName,
      itemIcon: listing.itemIcon,
      quantity: listing.quantity,
      finalStatus: listing.finalStatus,
      finalPrice: listing.finalPrice || null,
      finalBuyerName: listing.finalBuyerName || null,
      sellerName: listing.sellerName,
      settledTurn: listing.settledTurn
    };
  }

  getStateForPlayer(playerId) {
    return {
      activeListings: this.getActiveListings().map(l => this.listingToPublicState(l)),
      myListings: this.getPlayerListings(playerId).map(l => this.listingToPrivateState(l)),
      history: this.getHistory().map(l => this.historyToPublicState(l)),
      myActiveListingCount: this.getPlayerActiveListings(playerId).length,
      myActiveBidCount: this.getPlayerActiveBids(playerId).length,
      maxListings: CONFIG.AUCTION.MAX_LISTINGS_PER_PLAYER,
      maxBids: CONFIG.AUCTION.MAX_BIDS_PER_PLAYER,
      minBidIncrement: CONFIG.AUCTION.MIN_BID_INCREMENT_RATIO,
      itemTypes: CONFIG.AUCTION.ITEM_TYPES,
      minDuration: CONFIG.AUCTION.MIN_DURATION,
      maxDuration: CONFIG.AUCTION.MAX_DURATION,
      buyNowMinMultiplier: CONFIG.AUCTION.BUY_NOW_MIN_MULTIPLIER,
      taxRate: CONFIG.AUCTION.TAX_RATE,
      totalTaxCollected: this.totalTaxCollected
    };
  }

  listingToPublicState(listing) {
    return {
      id: listing.id,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      itemType: listing.itemType,
      itemName: listing.itemName,
      itemIcon: listing.itemIcon,
      quantity: listing.quantity,
      startPrice: listing.startPrice,
      currentPrice: listing.currentPrice,
      highestBidderId: listing.highestBidderId,
      highestBidderName: listing.highestBidderName,
      remainingTurns: listing.remainingTurns,
      duration: listing.duration,
      status: listing.status,
      buyNowEnabled: listing.buyNowEnabled,
      buyNowPrice: listing.buyNowPrice
    };
  }

  listingToPrivateState(listing) {
    return {
      ...this.listingToPublicState(listing),
      createdTurn: listing.createdTurn,
      settledTurn: listing.settledTurn || null,
      finalStatus: listing.finalStatus || null,
      finalPrice: listing.finalPrice || null,
      finalBuyerId: listing.finalBuyerId || null,
      finalBuyerName: listing.finalBuyerName || null,
      taxCollected: listing.taxCollected || null,
      sellerReceives: listing.sellerReceives || null
    };
  }
}

module.exports = AuctionManager;
