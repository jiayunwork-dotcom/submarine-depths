import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
import '../styles/AuctionPanel.css';

function AuctionPanel() {
  const {
    gameState,
    showAuctionPanel,
    setShowAuctionPanel,
    auctionTab,
    setAuctionTab,
    createAuction,
    placeAuctionBid,
    cancelAuction
  } = useGame();

  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('remaining');
  const [newItemType, setNewItemType] = useState('mineral');
  const [newQuantity, setNewQuantity] = useState('');
  const [newStartPrice, setNewStartPrice] = useState('');
  const [newDuration, setNewDuration] = useState('3');
  const [bidPrice, setBidPrice] = useState({});

  const auctions = gameState?.auctions;
  const currentPlayerId = gameState?.currentPlayer?.id;
  const currentPlayer = gameState?.currentPlayer;
  const phase = gameState?.phase;

  const activeListings = auctions?.activeListings || [];
  const myListings = auctions?.myListings || [];
  const myActiveListingCount = auctions?.myActiveListingCount || 0;
  const myActiveBidCount = auctions?.myActiveBidCount || 0;
  const maxListings = auctions?.maxListings || 3;
  const maxBids = auctions?.maxBids || 5;
  const minBidIncrement = auctions?.minBidIncrement || 0.1;
  const minDuration = auctions?.minDuration || 2;
  const maxDuration = auctions?.maxDuration || 6;
  const itemTypes = auctions?.itemTypes || CONFIG.AUCTION_ITEM_TYPES;

  const filteredAndSortedListings = useMemo(() => {
    let result = [...activeListings];

    if (filterType !== 'all') {
      result = result.filter(l => l.itemType === filterType);
    }

    result.sort((a, b) => {
      if (sortBy === 'remaining') {
        return a.remainingTurns - b.remainingTurns;
      } else if (sortBy === 'price_asc') {
        return a.currentPrice - b.currentPrice;
      } else if (sortBy === 'price_desc') {
        return b.currentPrice - a.currentPrice;
      }
      return 0;
    });

    return result;
  }, [activeListings, filterType, sortBy]);

  if (!auctions) return null;

  const getMinBid = (listing) => {
    const increment = Math.ceil(listing.startPrice * minBidIncrement);
    if (listing.highestBidderId === null) {
      return listing.startPrice;
    }
    return listing.currentPrice + increment;
  };

  const handleBid = (listingId) => {
    const price = parseInt(bidPrice[listingId]);
    if (!price || price <= 0) return;
    placeAuctionBid(listingId, price);
    setBidPrice(prev => ({ ...prev, [listingId]: '' }));
  };

  const handleQuickBid = (listing) => {
    const minBid = getMinBid(listing);
    placeAuctionBid(listing.id, minBid);
  };

  const handleCreateAuction = () => {
    const quantity = parseInt(newQuantity);
    const startPrice = parseInt(newStartPrice);
    const duration = parseInt(newDuration);

    if (!quantity || !startPrice || !duration) return;

    createAuction(newItemType, quantity, startPrice, duration);
    setNewQuantity('');
    setNewStartPrice('');
    setNewDuration('3');
  };

  const getListingStatus = (listing) => {
    if (listing.status === 'active') return '竞拍中';
    if (listing.finalStatus === 'sold') return '已成交';
    if (listing.finalStatus === 'flow') return '流拍';
    if (listing.status === 'cancelled') return '已取消';
    return listing.status;
  };

  const getStatusClass = (listing) => {
    if (listing.status === 'active') return 'status-active';
    if (listing.finalStatus === 'sold') return 'status-sold';
    if (listing.finalStatus === 'flow') return 'status-flow';
    if (listing.status === 'cancelled') return 'status-cancelled';
    return '';
  };

  const getAvailableResource = (type) => {
    if (!currentPlayer) return 0;
    if (type === 'mineral') return currentPlayer.base?.storage?.mineral || 0;
    if (type === 'bio_sample') return currentPlayer.base?.storage?.bio_sample || 0;
    if (type === 'techPoints') return currentPlayer.base?.techPoints || 0;
    return 0;
  };

  if (!showAuctionPanel) {
    return (
      <button
        className="auction-panel-btn"
        onClick={() => setShowAuctionPanel(true)}
      >
        🏛️ 拍卖行
        {(myActiveListingCount > 0 || myActiveBidCount > 0) && (
          <span className="auction-badge">{myActiveListingCount + myActiveBidCount}</span>
        )}
      </button>
    );
  }

  const renderMarketListing = (listing) => {
    const isOwnListing = listing.sellerId === currentPlayerId;
    const isHighestBidder = listing.highestBidderId === currentPlayerId;
    const minBid = getMinBid(listing);

    return (
      <div key={listing.id} className="auction-card">
        <div className="auction-card-header">
          <span className="auction-item-icon">{listing.itemIcon}</span>
          <span className="auction-item-name">{listing.itemName} × {listing.quantity}</span>
          <span className="auction-seller">卖家: {listing.sellerName}</span>
        </div>
        <div className="auction-card-body">
          <div className="auction-price-row">
            <span className="price-label">起拍价:</span>
            <span className="price-value">💎 {listing.startPrice}</span>
          </div>
          <div className="auction-price-row highlight">
            <span className="price-label">当前价:</span>
            <span className="price-value current">💎 {listing.currentPrice}</span>
            {isHighestBidder && <span className="highest-bidder-tag">你领先</span>}
          </div>
          {listing.highestBidderName && (
            <div className="auction-bidder">
              最高出价者: {listing.highestBidderName}
            </div>
          )}
          <div className="auction-timer">
            ⏱️ 剩余 {listing.remainingTurns} 回合
          </div>
        </div>
        {!isOwnListing && phase === 'planning' && (
          <div className="auction-bid-section">
            <div className="bid-input-row">
              <input
                type="number"
                className="bid-input"
                placeholder={`最低 ${minBid}`}
                value={bidPrice[listing.id] || ''}
                onChange={(e) => setBidPrice(prev => ({ ...prev, [listing.id]: e.target.value }))}
                min={minBid}
              />
              <button
                className="bid-btn"
                onClick={() => handleBid(listing.id)}
                disabled={!bidPrice[listing.id] || parseInt(bidPrice[listing.id]) < minBid}
              >
                出价
              </button>
            </div>
            <button
              className="quick-bid-btn"
              onClick={() => handleQuickBid(listing)}
              disabled={myActiveBidCount >= maxBids}
            >
              快速出价 💎{minBid}
            </button>
          </div>
        )}
        {isOwnListing && (
          <div className="auction-own-listing">
            {listing.highestBidderId === null && phase === 'planning' && (
              <button
                className="cancel-btn"
                onClick={() => cancelAuction(listing.id)}
              >
                取消拍卖
              </button>
            )}
            <span className="own-listing-tag">我的拍品</span>
          </div>
        )}
      </div>
    );
  };

  const renderMyListing = (listing) => {
    return (
      <div key={listing.id} className={`auction-card my-listing ${getStatusClass(listing)}`}>
        <div className="auction-card-header">
          <span className="auction-item-icon">{listing.itemIcon}</span>
          <span className="auction-item-name">{listing.itemName} × {listing.quantity}</span>
          <span className={`auction-status ${getStatusClass(listing)}`}>
            {getListingStatus(listing)}
          </span>
        </div>
        <div className="auction-card-body">
          <div className="auction-price-row">
            <span className="price-label">起拍价:</span>
            <span className="price-value">💎 {listing.startPrice}</span>
          </div>
          {listing.status === 'active' ? (
            <>
              <div className="auction-price-row highlight">
                <span className="price-label">当前价:</span>
                <span className="price-value current">💎 {listing.currentPrice}</span>
              </div>
              {listing.highestBidderName && (
                <div className="auction-bidder">
                  最高出价者: {listing.highestBidderName}
                </div>
              )}
              <div className="auction-timer">
                ⏱️ 剩余 {listing.remainingTurns} 回合
              </div>
              {listing.highestBidderId === null && phase === 'planning' && (
                <button
                  className="cancel-btn"
                  onClick={() => cancelAuction(listing.id)}
                >
                  取消拍卖
                </button>
              )}
            </>
          ) : (
            <>
              {listing.finalStatus === 'sold' && (
                <>
                  <div className="auction-price-row highlight">
                    <span className="price-label">成交价:</span>
                    <span className="price-value sold">💎 {listing.finalPrice}</span>
                  </div>
                  <div className="auction-buyer">
                    买家: {listing.finalBuyerName}
                  </div>
                </>
              )}
              {listing.finalStatus === 'flow' && (
                <div className="auction-flow-hint">物品已返还</div>
              )}
              {listing.status === 'cancelled' && (
                <div className="auction-cancelled-hint">已取消</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="auction-panel">
      <div className="auction-panel-header">
        <h3>🏛️ 深海拍卖行</h3>
        <button className="close-btn" onClick={() => setShowAuctionPanel(false)}>
          ×
        </button>
      </div>

      <div className="auction-stats">
        <div className="stat-item">
          <span className="stat-label">我的挂单:</span>
          <span className="stat-value">{myActiveListingCount}/{maxListings}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">参与竞价:</span>
          <span className="stat-value">{myActiveBidCount}/{maxBids}</span>
        </div>
      </div>

      <div className="auction-tabs">
        <button
          className={`tab-btn ${auctionTab === 'market' ? 'active' : ''}`}
          onClick={() => setAuctionTab('market')}
        >
          市场 {activeListings.length > 0 && <span className="tab-badge">{activeListings.length}</span>}
        </button>
        <button
          className={`tab-btn ${auctionTab === 'my' ? 'active' : ''}`}
          onClick={() => setAuctionTab('my')}
        >
          我的拍品
        </button>
        <button
          className={`tab-btn ${auctionTab === 'create' ? 'active' : ''}`}
          onClick={() => setAuctionTab('create')}
        >
          挂牌
        </button>
      </div>

      {auctionTab === 'market' && (
        <div className="auction-market">
          <div className="auction-filters">
            <div className="filter-group">
              <span className="filter-label">类型:</span>
              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">全部</option>
                {Object.entries(itemTypes).map(([key, config]) => (
                  <option key={key} value={key}>{config.icon} {config.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">排序:</span>
              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="remaining">剩余时间</option>
                <option value="price_asc">价格从低到高</option>
                <option value="price_desc">价格从高到低</option>
              </select>
            </div>
          </div>
          <div className="auction-list">
            {filteredAndSortedListings.length > 0 ? (
              filteredAndSortedListings.map(renderMarketListing)
            ) : (
              <div className="no-auctions">暂无在拍物品</div>
            )}
          </div>
        </div>
      )}

      {auctionTab === 'my' && (
        <div className="auction-my-list">
          {myListings.length > 0 ? (
            myListings.map(renderMyListing)
          ) : (
            <div className="no-auctions">暂无拍品记录</div>
          )}
        </div>
      )}

      {auctionTab === 'create' && (
        <div className="auction-create">
          {myActiveListingCount >= maxListings ? (
            <div className="max-listings-reached">
              你已达到最大挂单数量 ({maxListings})，请等待部分拍卖结束后再挂牌
            </div>
          ) : (
            <>
              <div className="create-form">
                <div className="form-group">
                  <label>物品类型</label>
                  <select
                    className="form-select"
                    value={newItemType}
                    onChange={(e) => {
                      setNewItemType(e.target.value);
                      setNewQuantity('');
                    }}
                  >
                    {Object.entries(itemTypes).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.icon} {config.name} (最低{config.minQuantity}单位)
                      </option>
                    ))}
                  </select>
                  <div className="resource-hint">
                    当前持有: {getAvailableResource(newItemType)} {itemTypes[newItemType].name}
                  </div>
                </div>

                <div className="form-group">
                  <label>数量 (最低{itemTypes[newItemType].minQuantity})</label>
                  <input
                    type="number"
                    className="form-input"
                    min={itemTypes[newItemType].minQuantity}
                    max={getAvailableResource(newItemType)}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder={`输入数量，最低${itemTypes[newItemType].minQuantity}`}
                  />
                </div>

                <div className="form-group">
                  <label>起拍价 (矿物)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={newStartPrice}
                    onChange={(e) => setNewStartPrice(e.target.value)}
                    placeholder="输入起拍价"
                  />
                </div>

                <div className="form-group">
                  <label>持续回合 ({minDuration}-{maxDuration}回合)</label>
                  <select
                    className="form-select"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                  >
                    {Array.from({ length: maxDuration - minDuration + 1 }, (_, i) => i + minDuration).map(n => (
                      <option key={n} value={n}>{n} 回合</option>
                    ))}
                  </select>
                </div>

                <button
                  className="create-auction-btn"
                  onClick={handleCreateAuction}
                  disabled={
                    phase !== 'planning' ||
                    !newQuantity ||
                    parseInt(newQuantity) < itemTypes[newItemType].minQuantity ||
                    parseInt(newQuantity) > getAvailableResource(newItemType) ||
                    !newStartPrice ||
                    parseInt(newStartPrice) <= 0
                  }
                >
                  挂牌出售
                </button>

                {phase !== 'planning' && (
                  <div className="phase-hint">仅在规划阶段可以挂牌</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AuctionPanel;
