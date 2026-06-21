const { v4: uuidv4 } = require('uuid');
const CONFIG = require('./config');

class AuctionManager {
  constructor(game) {
    this.game = game;
    this.listings = [];
    this.history = [];
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

  createListing(playerId, itemType, quantity, startPrice, duration) {
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
      status: 'active'
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
  }

  settleAuction(listing) {
    listing.status = 'settled';

    const seller = this.game.getPlayer(listing.sellerId);

    if (listing.highestBidderId === null) {
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
      const buyer = this.game.getPlayer(listing.highestBidderId);
      listing.finalStatus = 'sold';
      listing.finalPrice = listing.currentPrice;
      listing.finalBuyerId = listing.highestBidderId;
      listing.finalBuyerName = listing.highestBidderName;

      if (seller) {
        seller.base.storage.mineral += listing.currentPrice;
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
        buyerId: listing.highestBidderId,
        buyerName: listing.highestBidderName,
        itemType: listing.itemType,
        quantity: listing.quantity,
        finalPrice: listing.currentPrice,
        turn: this.game.turn,
        message: `${listing.highestBidderName} 以 ${listing.currentPrice} 矿物拍下了 ${listing.sellerName} 的 ${listing.quantity} ${listing.itemName}`
      });
    }

    this.history.push({ ...listing });
    this.listings = this.listings.filter(l => l.id !== listing.id);
  }

  getActiveListings() {
    return this.listings.filter(l => l.status === 'active');
  }

  getPlayerListings(playerId) {
    const active = this.listings.filter(l => l.sellerId === playerId && l.status === 'active');
    const history = this.history.filter(l => l.sellerId === playerId);
    return [...active, ...history];
  }

  getStateForPlayer(playerId) {
    return {
      activeListings: this.getActiveListings().map(l => this.listingToPublicState(l)),
      myListings: this.getPlayerListings(playerId).map(l => this.listingToPrivateState(l)),
      myActiveListingCount: this.getPlayerActiveListings(playerId).length,
      myActiveBidCount: this.getPlayerActiveBids(playerId).length,
      maxListings: CONFIG.AUCTION.MAX_LISTINGS_PER_PLAYER,
      maxBids: CONFIG.AUCTION.MAX_BIDS_PER_PLAYER,
      minBidIncrement: CONFIG.AUCTION.MIN_BID_INCREMENT_RATIO,
      itemTypes: CONFIG.AUCTION.ITEM_TYPES,
      minDuration: CONFIG.AUCTION.MIN_DURATION,
      maxDuration: CONFIG.AUCTION.MAX_DURATION
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
      status: listing.status
    };
  }

  listingToPrivateState(listing) {
    return {
      ...this.listingToPublicState(listing),
      createdTurn: listing.createdTurn,
      finalStatus: listing.finalStatus || null,
      finalPrice: listing.finalPrice || null,
      finalBuyerId: listing.finalBuyerId || null,
      finalBuyerName: listing.finalBuyerName || null
    };
  }
}

module.exports = AuctionManager;
