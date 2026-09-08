// Badge System for SSoW Whale Gallery
// All 56 Achievement Badges with localStorage Progress Tracking
// UPDATED: Automatic badge unlocking + Mobile-friendly

// ========================================
// localStorage Functions
// ========================================

// Get unlocked badges for a specific wallet
function getUnlockedBadgesForWallet(walletAddress) {
    const normalized = walletAddress.toLowerCase();
    const data = JSON.parse(localStorage.getItem('ssow_badge_progress') || '{}');
    return data[normalized] || [];
}

// Save unlocked badges for a specific wallet
function saveUnlockedBadgesForWallet(walletAddress, unlockedBadges) {
    const normalized = walletAddress.toLowerCase();
    const data = JSON.parse(localStorage.getItem('ssow_badge_progress') || '{}');
    data[normalized] = unlockedBadges;
    localStorage.setItem('ssow_badge_progress', JSON.stringify(data));
}

// Reset progress for a wallet
function resetWalletProgress(walletAddress) {
    const normalized = walletAddress.toLowerCase();
    const data = JSON.parse(localStorage.getItem('ssow_badge_progress') || '{}');
    delete data[normalized];
    localStorage.setItem('ssow_badge_progress', JSON.stringify(data));
}

// Mobile Detection & Emoji Fallbacks
function isMobileDevice() {
    // Check multiple ways to detect mobile
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 1024; // Changed from 768 to 1024 to catch tablets and large phones
    
    // If any of these are true, treat as mobile
    return isMobileUA || (isTouchDevice && isSmallScreen);
}


// Get emoji for current device
function getEmoji(emoji) {
    const isMobile = isMobileDevice();
    
    if (!isMobile) {
        return emoji; // Desktop - use original emoji
    }
    
    // Mobile - use Twemoji images
    const codePoint = [...emoji]
        .filter(char => {
            const code = char.codePointAt(0);
            return code !== 0xFE0E && code !== 0xFE0F && code !== 0x200D;
        })
        .map(char => char.codePointAt(0).toString(16))
        .join('-');
    
    return `<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoint}.png" 
                 width="48" height="48" 
                 style="display: inline-block; vertical-align: middle;" 
                 alt="${emoji}" 
                 loading="eager" 
                 crossorigin="anonymous"
                 onerror="this.style.display='none'">`;
}

// Preload all emoji images for mobile to prevent loading failures
function preloadBadgeEmojis() {
    if (!isMobileDevice()) return;
    
    console.log('Preloading badge emojis for mobile...');
    
    // Get all unique emojis from badges
    const uniqueEmojis = [...new Set(Object.values(BADGES).map(b => b.icon))];
    
    // Preload each emoji image
    uniqueEmojis.forEach(emoji => {
        const codePoint = [...emoji]
            .filter(char => {
                const code = char.codePointAt(0);
                return code !== 0xFE0E && code !== 0xFE0F && code !== 0x200D;
            })
            .map(char => char.codePointAt(0).toString(16))
            .join('-');
        
        const img = new Image();
        img.src = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoint}.png`;
        img.crossOrigin = "anonymous";
    });
    
    console.log(`Preloaded ${uniqueEmojis.length} unique emoji images`);
}

// Badge Definitions
const BADGES = {
    // Collection Size (10 badges)
    'first-whale': {
        id: 'first-whale',
        name: 'First Whale',
        icon: '🐋',
        description: 'Own 1+ whale',
        category: 'collection',
        rarity: 'common',
        check: (nfts) => nfts.length >= 1
    },
    'duo': {
        id: 'duo',
        name: 'Duo',
        icon: '🐳',
        description: 'Own 2+ whales',
        category: 'collection',
        rarity: 'common',
        check: (nfts) => nfts.length >= 2
    },
    'trio': {
        id: 'trio',
        name: 'Trio',
        icon: '🌊',
        description: 'Own 3+ whales',
        category: 'collection',
        rarity: 'common',
        check: (nfts) => nfts.length >= 3
    },
    'hand-full': {
        id: 'hand-full',
        name: 'Hand Full',
        icon: '🌊',
        description: 'Own 5+ whales',
        category: 'collection',
        rarity: 'common',
        check: (nfts) => nfts.length >= 5
    },
    'perfect-10': {
        id: 'perfect-10',
        name: 'Perfect 10',
        icon: '🌊',
        description: 'Own 10+ whales',
        category: 'collection',
        rarity: 'rare',
        check: (nfts) => nfts.length >= 10
    },
    'bakers-dozen': {
        id: 'bakers-dozen',
        name: "Baker's Dozen",
        icon: '🏔',
        description: 'Own 13+ whales',
        category: 'collection',
        rarity: 'rare',
        check: (nfts) => nfts.length >= 13
    },
    'score': {
        id: 'score',
        name: 'Score',
        icon: '⭐',
        description: 'Own 20+ whales',
        category: 'collection',
        rarity: 'epic',
        check: (nfts) => nfts.length >= 20
    },
    'quarter-century': {
        id: 'quarter-century',
        name: 'Quarter Century',
        icon: '🎊',
        description: 'Own 25+ whales',
        category: 'collection',
        rarity: 'epic',
        check: (nfts) => nfts.length >= 25
    },
    'big-baller': {
        id: 'big-baller',
        name: 'Big Baller',
        icon: '💪',
        description: 'Own 50+ whales',
        category: 'collection',
        rarity: 'legendary',
        check: (nfts) => nfts.length >= 50
    },
    'whale-century': {
        id: 'whale-century',
        name: 'Whale Century',
        icon: '👑',
        description: 'Own 100+ whales',
        category: 'collection',
        rarity: 'legendary',
        check: (nfts) => nfts.length >= 100
    },

    // Rarity Hunters (12 badges)
    'one-percent-club': {
        id: 'one-percent-club',
        name: 'The 1% Club',
        icon: '💎',
        description: 'Own ANY trait <1% rarity',
        category: 'rarity',
        rarity: 'rare',
        check: (nfts) => {
            const ogNfts = nfts.filter(nft => nft.collection === 'OG Whales');
            return ogNfts.some(nft => {
                if (!nft.traits || !window.TRAIT_RARITIES) return false;
                return Object.entries(nft.traits).some(([category, value]) => {
                    const rarityData = window.TRAIT_RARITIES[category]?.[value];
                    return rarityData && rarityData.percentage < 1;
                });
            });
        }
    },
    'double-rare': {
        id: 'double-rare',
        name: 'Double Rare',
        icon: '🦄',
        description: 'Own whale with 2+ traits <1%',
        category: 'rarity',
        rarity: 'epic',
        check: (nfts) => {
            const ogNfts = nfts.filter(nft => nft.collection === 'OG Whales');
            return ogNfts.some(nft => {
                if (!nft.traits || !window.TRAIT_RARITIES) return false;
                const rareCount = Object.entries(nft.traits).filter(([category, value]) => {
                    const rarityData = window.TRAIT_RARITIES[category]?.[value];
                    return rarityData && rarityData.percentage < 1;
                }).length;
                return rareCount >= 2;
            });
        }
    },
    'top-2000': {
        id: 'top-2000',
        name: 'Top 2000 Club',
        icon: '⭐',
        description: 'Own a top 2000 rarity whale',
        category: 'rarity',
        rarity: 'rare',
        check: (nfts) => nfts.some(nft => nft.rank && nft.rank <= 2000)
    },
    'top-500': {
        id: 'top-500',
        name: 'Top 500 Club',
        icon: '🔥',
        description: 'Own a top 500 rarity whale',
        category: 'rarity',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => nft.rank && nft.rank <= 500)
    },
    'top-100': {
        id: 'top-100',
        name: 'Top 100 Club',
        icon: '⭐',
        description: 'Own a top 100 rarity whale',
        category: 'rarity',
        rarity: 'legendary',
        check: (nfts) => nfts.some(nft => nft.rank && nft.rank <= 100)
    },
    'gold-rush': {
        id: 'gold-rush',
        name: 'Gold Rush',
        icon: '💰',
        description: 'Own Gold Skin (0.49%)',
        category: 'rarity',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => nft.traits?.skin === 'Gold')
    },
    'ice-age': {
        id: 'ice-age',
        name: 'Ice Age',
        icon: '❄',
        description: 'Own Ice Skin (0.86%)',
        category: 'rarity',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => nft.traits?.skin === 'Ice')
    },
    'trippy-traveler': {
        id: 'trippy-traveler',
        name: 'Trippy Traveler',
        icon: '✨',
        description: 'Own Trippy Skin (1.07%)',
        category: 'rarity',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => nft.traits?.skin === 'Trippy')
    },
    'mega-bot': {
        id: 'mega-bot',
        name: 'Mega Bot Master',
        icon: '⭐',
        description: 'Own Mega Bot Skin (0.92%)',
        category: 'rarity',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => nft.traits?.skin === 'Mega Bot')
    },
    'lightning': {
        id: 'lightning',
        name: 'Lightning Strikes',
        icon: '🔥',
        description: 'Own Lightning Skin (1.67%)',
        category: 'rarity',
        rarity: 'rare',
        check: (nfts) => nfts.some(nft => nft.traits?.skin === 'Lightning')
    },
    'any-super-rare': {
        id: 'any-super-rare',
        name: 'Any Super Rare',
        icon: '⭐',
        description: 'Own ANY skin <2% rarity',
        category: 'rarity',
        rarity: 'rare',
        check: (nfts) => {
            const superRareSkins = ['Gold', 'Ice', 'Trippy', 'Mega Bot', 'Lightning'];
            return nfts.some(nft => superRareSkins.includes(nft.traits?.skin));
        }
    },
    'laser-vision': {
        id: 'laser-vision',
        name: 'Laser Vision',
        icon: '😎',
        description: 'Own Laser or Green Laser eyes',
        category: 'rarity',
        rarity: 'rare',
        check: (nfts) => nfts.some(nft => 
            nft.traits?.eyes === 'Laser' || nft.traits?.eyes === 'Green Lasers'
        )
    },

    // Trait Variety (8 badges)
    'skin-variety': {
        id: 'skin-variety',
        name: 'Skin Variety',
        icon: '💎',
        description: 'Own 3+ different skins',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const skins = new Set(nfts.map(nft => nft.traits?.skin).filter(Boolean));
            return skins.size >= 3;
        }
    },
    'hat-variety': {
        id: 'hat-variety',
        name: 'Hat Variety',
        icon: '☀',
        description: 'Own 5+ different hats',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const hats = new Set(nfts.map(nft => nft.traits?.hat).filter(Boolean));
            return hats.size >= 5;
        }
    },
    'outfit-variety': {
        id: 'outfit-variety',
        name: 'Outfit Variety',
        icon: '⭐',
        description: 'Own 5+ different outfits',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const outfits = new Set(nfts.map(nft => nft.traits?.outfit).filter(Boolean));
            return outfits.size >= 5;
        }
    },
    'background-variety': {
        id: 'background-variety',
        name: 'Background Variety',
        icon: '☁',
        description: 'Own 3+ different backgrounds',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const backgrounds = new Set(nfts.map(nft => nft.traits?.background).filter(Boolean));
            return backgrounds.size >= 3;
        }
    },
    'eye-variety': {
        id: 'eye-variety',
        name: 'Eye Variety',
        icon: '👀',
        description: 'Own 5+ different eye types',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const eyes = new Set(nfts.map(nft => nft.traits?.eyes).filter(Boolean));
            return eyes.size >= 5;
        }
    },
    'expression-variety': {
        id: 'expression-variety',
        name: 'Expression Variety',
        icon: '😊',
        description: 'Own 3+ different mouths',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const mouths = new Set(nfts.map(nft => nft.traits?.mouth).filter(Boolean));
            return mouths.size >= 3;
        }
    },
    'fin-variety': {
        id: 'fin-variety',
        name: 'Fin Variety',
        icon: '🐟',
        description: 'Own 2+ different fin types',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const fins = new Set(nfts.map(nft => nft.traits?.fins).filter(Boolean));
            return fins.size >= 2;
        }
    },
    'ring-variety': {
        id: 'ring-variety',
        name: 'Ring Variety',
        icon: '💎',
        description: 'Own 3+ different blowhole rings',
        category: 'variety',
        rarity: 'common',
        check: (nfts) => {
            const rings = new Set(nfts.map(nft => nft.traits?.blowholeRing).filter(Boolean));
            return rings.size >= 3;
        }
    },

    // Themed Collections (10 badges)
    'professional': {
        id: 'professional',
        name: 'The Professional',
        icon: '👔',
        description: 'Own 2+ work outfit whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const workOutfits = ['Nice Suit Guy', 'Salesman', 'Venture Capitalist', 'Tech CEO'];
            const count = nfts.filter(nft => workOutfits.includes(nft.traits?.outfit)).length;
            return count >= 2;
        }
    },
    'partier': {
        id: 'partier',
        name: 'The Partier',
        icon: '🎊',
        description: 'Own 2+ party whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const partyOutfits = ['Raver', 'Night Club Owner', 'Play Boy', 'Rockstar'];
            const count = nfts.filter(nft => partyOutfits.includes(nft.traits?.outfit)).length;
            return count >= 2;
        }
    },
    'hustler': {
        id: 'hustler',
        name: 'The Hustler',
        icon: '💰',
        description: 'Own 2+ money-themed whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const moneyOutfits = ['Day Trader', 'Sports Bettor', 'Magnate', 'Trust Fund Kid'];
            const count = nfts.filter(nft => moneyOutfits.includes(nft.traits?.outfit)).length;
            return count >= 2;
        }
    },
    'creative': {
        id: 'creative',
        name: 'The Creative',
        icon: '🎨',
        description: 'Own 2+ creative whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const creativeOutfits = ['NFT Artist', 'Fashion Designer', 'Stylist', 'Hip Hop Artist'];
            const count = nfts.filter(nft => creativeOutfits.includes(nft.traits?.outfit)).length;
            return count >= 2;
        }
    },
    'blue-collar': {
        id: 'blue-collar',
        name: 'Blue Collar Hero',
        icon: '⚙',
        description: 'Own 2+ working class whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const workingOutfits = ['Construction Worker', 'Fisherman', 'Lumberjack', 'Barista'];
            const count = nfts.filter(nft => workingOutfits.includes(nft.traits?.outfit)).length;
            return count >= 2;
        }
    },
    'sailor': {
        id: 'sailor',
        name: 'The Sailor',
        icon: '🌊',
        description: 'Own 2+ ocean-themed whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const oceanOutfits = ['Sailor', 'Pirate Hat', 'Fisherman', 'Seaman Hat'];
            const count = nfts.filter(nft => 
                oceanOutfits.includes(nft.traits?.outfit) || oceanOutfits.includes(nft.traits?.hat)
            ).length;
            return count >= 2;
        }
    },
    'scholar': {
        id: 'scholar',
        name: 'The Scholar',
        icon: '🎓',
        description: 'Own 2+ educated whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const educatedOutfits = ['Student', 'Philosopher', 'Software Engineer'];
            const count = nfts.filter(nft => 
                educatedOutfits.includes(nft.traits?.outfit) || nft.traits?.hat === 'Graduation Cap'
            ).length;
            return count >= 2;
        }
    },
    'medical': {
        id: 'medical',
        name: 'Medical Team',
        icon: '💊',
        description: 'Own Doctor + Nurse',
        category: 'themed',
        rarity: 'epic',
        check: (nfts) => {
            const hasDoctor = nfts.some(nft => nft.traits?.outfit === 'Doctor');
            const hasNurse = nfts.some(nft => nft.traits?.outfit === 'Nurse');
            return hasDoctor && hasNurse;
        }
    },
    'bling': {
        id: 'bling',
        name: 'Bling Squad',
        icon: '💎',
        description: 'Own any 2 gold/diamond accessories',
        category: 'themed',
        rarity: 'epic',
        check: (nfts) => {
            const blingAccessories = ['Gold Hoop', 'Gold Stud', 'Diamond', 'Round Diamond', 'Chandelier'];
            const count = nfts.filter(nft => blingAccessories.includes(nft.traits?.blowholeRing)).length;
            return count >= 2;
        }
    },
    'entertainer': {
        id: 'entertainer',
        name: 'The Entertainer',
        icon: '🎵',
        description: 'Own 2+ entertainment whales',
        category: 'themed',
        rarity: 'rare',
        check: (nfts) => {
            const entertainOutfits = ['Actress', 'Mime', 'Rockstar', 'Hip Hop Artist'];
            const count = nfts.filter(nft => entertainOutfits.includes(nft.traits?.outfit)).length;
            return count >= 2;
        }
    },

    // Token ID Fun (5 badges)
    'under-1000': {
        id: 'under-1000',
        name: 'Under 1000',
        icon: '⭐',
        description: 'Own token ID <1000',
        category: 'tokenid',
        rarity: 'rare',
        check: (nfts) => nfts.some(nft => parseInt(nft.tokenId) < 1000)
    },
    'lucky-7': {
        id: 'lucky-7',
        name: 'Lucky 7',
        icon: '🍀',
        description: 'Own whale with 7 in token ID',
        category: 'tokenid',
        rarity: 'common',
        check: (nfts) => nfts.some(nft => nft.tokenId.includes('7'))
    },
    'repeating': {
        id: 'repeating',
        name: 'Repeating Digits',
        icon: '🔁',
        description: 'Own whale with repeating numbers',
        category: 'tokenid',
        rarity: 'rare',
        check: (nfts) => nfts.some(nft => {
            const id = nft.tokenId;
            return /(\d)\1{2,}/.test(id); // 3+ same digits in a row
        })
    },
    'round-number': {
        id: 'round-number',
        name: 'Round Number',
        icon: '🎯',
        description: 'Own whale at #100, #500, #1000, etc.',
        category: 'tokenid',
        rarity: 'epic',
        check: (nfts) => {
            const roundNumbers = [100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
            return nfts.some(nft => roundNumbers.includes(parseInt(nft.tokenId)));
        }
    },
    'palindrome': {
        id: 'palindrome',
        name: 'Palindrome',
        icon: '🔄',
        description: 'Own palindrome token ID',
        category: 'tokenid',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => {
            const id = nft.tokenId;
            return id === id.split('').reverse().join('');
        })
    },

    // Secret/Combo (5 badges)
    'royalty': {
        id: 'royalty',
        name: 'Royalty',
        icon: '👑',
        description: 'Own Crown of Neptune hat',
        category: 'secret',
        rarity: 'legendary',
        check: (nfts) => nfts.some(nft => nft.traits?.hat === 'Crown of Neptune')
    },
    'trippy-combo': {
        id: 'trippy-combo',
        name: 'Trippy Combo',
        icon: '🌈',
        description: 'Own Trippy skin OR Tripping eyes',
        category: 'secret',
        rarity: 'epic',
        check: (nfts) => nfts.some(nft => 
            nft.traits?.skin === 'Trippy' || nft.traits?.eyes === 'Tripping'
        )
    },
    'grill-owner': {
        id: 'grill-owner',
        name: 'Grill Owner',
        icon: '😁',
        description: 'Own ANY grill type',
        category: 'secret',
        rarity: 'rare',
        check: (nfts) => nfts.some(nft => {
            const mouth = nft.traits?.mouth;
            return mouth && mouth.toLowerCase().includes('grill');
        })
    },
    'triple-grill': {
        id: 'triple-grill',
        name: 'Triple Grill Master',
        icon: '⭐',
        description: 'Own all 3 grills (Gold, Ice, Rainbow)',
        category: 'secret',
        rarity: 'legendary',
        check: (nfts) => {
            const hasGoldGrill = nfts.some(nft => nft.traits?.mouth === 'Gold Grill');
            const hasIceGrill = nfts.some(nft => nft.traits?.mouth === 'Ice Grill');
            const hasRainbowGrill = nfts.some(nft => nft.traits?.mouth === 'Rainbow Grill');
            return hasGoldGrill && hasIceGrill && hasRainbowGrill;
        }
    },
    '420-friendly': {
        id: '420-friendly',
        name: '420 Friendly',
        icon: '🍀',
        description: 'Own whale #420',
        category: 'secret',
        rarity: 'legendary',
        check: (nfts) => nfts.some(nft => nft.tokenId === '420')
    },
    'nice': {
        id: 'nice',
        name: 'Nice',
        icon: '😎',
        description: 'Own whale #69',
        category: 'secret',
        rarity: 'legendary',
        check: (nfts) => nfts.some(nft => nft.tokenId === '69')
    },

    // Elite Collector (5 badges)
    'diversity-master': {
        id: 'diversity-master',
        name: 'Whale Diversity Master',
        icon: '🌊',
        description: 'Own 10+ different skins',
        category: 'elite',
        rarity: 'legendary',
        check: (nfts) => {
            const skins = new Set(nfts.map(nft => nft.traits?.skin).filter(Boolean));
            return skins.size >= 10;
        }
    },
    'top-25': {
        id: 'top-25',
        name: 'Top 25 Collector',
        icon: '🎯',
        description: 'Own 3+ whales in top 25 rarity',
        category: 'elite',
        rarity: 'legendary',
        check: (nfts) => {
            const top25Count = nfts.filter(nft => nft.rank && nft.rank <= 25).length;
            return top25Count >= 3;
        }
    },
    'triple-rare': {
        id: 'triple-rare',
        name: 'Triple Rare Hunter',
        icon: '💎',
        description: 'Own 3+ whales with 2+ traits <1% each',
        category: 'elite',
        rarity: 'legendary',
        check: (nfts) => {
            const ogNfts = nfts.filter(nft => nft.collection === 'OG Whales');
            const doubleRareCount = ogNfts.filter(nft => {
                if (!nft.traits || !window.TRAIT_RARITIES) return false;
                const rareCount = Object.entries(nft.traits).filter(([category, value]) => {
                    const rarityData = window.TRAIT_RARITIES[category]?.[value];
                    return rarityData && rarityData.percentage < 1;
                }).length;
                return rareCount >= 2;
            }).length;
            return doubleRareCount >= 3;
        }
    },
    'quad-gold': {
        id: 'quad-gold',
        name: 'Quad Gold',
        icon: '👑',
        description: 'Own 4+ of Gold/Ice/Trippy/Mega Bot skins',
        category: 'elite',
        rarity: 'legendary',
        check: (nfts) => {
            const superRareSkins = ['Gold', 'Ice', 'Trippy', 'Mega Bot'];
            const count = nfts.filter(nft => superRareSkins.includes(nft.traits?.skin)).length;
            return count >= 4;
        }
    },
    'elite-trait': {
        id: 'elite-trait',
        name: 'Elite Trait Combo',
        icon: '⚡',
        description: 'Own whale with 4+ traits <2% rarity',
        category: 'elite',
        rarity: 'legendary',
        check: (nfts) => {
            const ogNfts = nfts.filter(nft => nft.collection === 'OG Whales');
            return ogNfts.some(nft => {
                if (!nft.traits || !window.TRAIT_RARITIES) return false;
                const rareCount = Object.entries(nft.traits).filter(([category, value]) => {
                    const rarityData = window.TRAIT_RARITIES[category]?.[value];
                    return rarityData && rarityData.percentage < 2;
                }).length;
                return rareCount >= 4;
            });
        }
    }
};

// Calculate which badges a user has qualified for and earned
function calculateBadges(nfts, walletAddress) {
    const results = {
        qualified: [],    // Badges the user qualifies for
        unlocked: [],     // Badges already unlocked (from localStorage)
        locked: [],       // Badges not qualified for OR qualified but not unlocked yet
        newQualified: []  // NEW badges earned this session (qualified but not in localStorage)
    };

    // Get previously unlocked badges from localStorage
    const previouslyUnlocked = getUnlockedBadgesForWallet(walletAddress);

    // Check each badge
    Object.values(BADGES).forEach(badge => {
        let qualifies = false;
        
        try {
            qualifies = badge.check(nfts);
        } catch (error) {
            console.warn(`Error checking badge ${badge.id}:`, error);
        }
        
        if (qualifies) {
            results.qualified.push(badge.id);
            
            // Check if already unlocked
            if (previouslyUnlocked.includes(badge.id)) {
                results.unlocked.push(badge.id);
            } else {
                // New badge that qualifies but hasn't been unlocked yet
                results.newQualified.push(badge.id);
                // Auto-unlock it immediately
                results.unlocked.push(badge.id);
            }
        } else {
            results.locked.push(badge.id);
        }
    });

    // Save all qualified badges to localStorage (auto-unlock)
    saveUnlockedBadgesForWallet(walletAddress, results.unlocked);

    return results;
}

// Get badge tier based on count
function getBadgeTier(count) {
    if (count >= 56) return { name: 'PERFECT WHALE', emoji: '🏆', color: '#FFD700' };
    if (count >= 49) return { name: 'Almost Perfect', emoji: '🌟', color: '#FFD700' };
    if (count >= 42) return { name: 'Legendary', emoji: '👑', color: '#FF6B9D' };
    if (count >= 32) return { name: 'Elite Achiever', emoji: '💎', color: '#9D4EDD' };
    if (count >= 22) return { name: 'Achievement Hunter', emoji: '⭐', color: '#3B82F6' };
    if (count >= 12) return { name: 'Badge Hunter', emoji: '🎯', color: '#00F5D4' };
    return { name: 'Whale Friend', emoji: '🐳', color: '#60A5FA' };
}

// Render badge grid
function renderBadges(badgeResults, activeCategory = 'all') {
    const grid = document.getElementById('badgeGrid');
    if (!grid) return;

    grid.innerHTML = '';

    let badgesToShow = Object.values(BADGES);

    // Filter by category
    if (activeCategory === 'unlocked') {
        badgesToShow = badgesToShow.filter(b => badgeResults.unlocked.includes(b.id));
    } else if (activeCategory === 'locked') {
        badgesToShow = badgesToShow.filter(b => badgeResults.locked.includes(b.id));
    } else if (activeCategory !== 'all') {
        badgesToShow = badgesToShow.filter(b => b.category === activeCategory);
    }

    badgesToShow.forEach(badge => {
        const isUnlocked = badgeResults.unlocked.includes(badge.id);
        const card = document.createElement('div');
        card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        // Use mobile-friendly emoji if on mobile device
        const displayIcon = getEmoji(badge.icon);
        
        // Always show the actual badge details (locked badges are just dimmed)
        card.innerHTML = `
            <div class="badge-rarity ${badge.rarity}">${badge.rarity}</div>
            <div class="badge-icon">${displayIcon}</div>
            <div class="badge-title">${badge.name}</div>
            <div class="badge-description">${badge.description}</div>
            <div class="badge-status">${isUnlocked ? '✓ UNLOCKED' : '🔒 LOCKED'}</div>
        `;
        
        grid.appendChild(card);
    });
}

// Update badge header
function updateBadgeHeader(badgeResults) {
    const count = badgeResults.unlocked.length;
    const total = Object.keys(BADGES).length;
    const percentage = Math.round((count / total) * 100);
    const tier = getBadgeTier(count);

    document.getElementById('badgeCount').textContent = `${count}/${total}`;
    document.getElementById('badgeProgressBar').style.width = `${percentage}%`;
    document.getElementById('badgeTier').textContent = `${tier.emoji} ${tier.name}`;
    document.getElementById('badgeTier').style.color = tier.color;
    document.getElementById('badgePanelTitle').textContent = `Your Achievements (${count}/${total})`;
}

// Toggle badge panel
function toggleBadgePanel() {
    const panel = document.getElementById('badgePanel');
    panel.classList.toggle('show');
}

// Show badge notification (only for newly earned badges)
function showBadgeNotification(badgeId) {
    const notification = document.getElementById('badgeNotification');
    const badgeObj = BADGES[badgeId];
    
    if (!badgeObj) return;

    // Update notification content
    document.getElementById('notificationIcon').textContent = badgeObj.icon;
    document.getElementById('notificationName').textContent = badgeObj.name;
    document.getElementById('notificationDesc').textContent = badgeObj.description;
    
    const badgeResults = window.currentBadgeResults;
    const count = badgeResults.unlocked.length;
    const total = Object.keys(BADGES).length; // Total badges dynamically
    const tier = getBadgeTier(count);
    
    document.getElementById('notificationProgress').textContent = `Progress: ${count}/${total} badges`;
    document.getElementById('notificationTier').textContent = `Tier: ${tier.emoji} ${tier.name}`;

    // Show notification
    notification.classList.add('show');

    // Create confetti
    createConfetti();

    // Auto-close after 2.5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2500);
}

// Close notification manually
function closeNotification() {
    const notification = document.getElementById('badgeNotification');
    notification.classList.remove('show');
}

// Confetti animation
function createConfetti() {
    const colors = ['#00f5d4', '#3b82f6', '#ff6b9d', '#FFD700', '#9D4EDD'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -20px;
            opacity: ${Math.random() * 0.7 + 0.3};
            transform: rotate(${Math.random() * 360}deg);
            animation: confettiFall ${2 + Math.random() * 2}s ease-out forwards;
            pointer-events: none;
            z-index: 10000;
        `;
        document.body.appendChild(confetti);
        
        // Remove after animation
        setTimeout(() => confetti.remove(), 4000);
    }
}

// Add confetti animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(${Math.random() * 720}deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Cleanup any lingering confetti
function cleanupConfetti() {
    document.querySelectorAll('.confetti').forEach(c => c.remove());
}

// Setup badge category filters
function setupBadgeCategories() {
    // Use existing buttons from HTML instead of creating new ones
    const buttons = document.querySelectorAll('.badge-category-btn');
    
    buttons.forEach(btn => {
        btn.onclick = () => {
            // Remove active from all buttons
            buttons.forEach(b => b.classList.remove('active'));
            // Add active to clicked button
            btn.classList.add('active');
            
            // Get category from button
            const category = btn.getAttribute('data-category') || 'all';
            
            // Map 'traits' to 'variety' for compatibility
            const mappedCategory = category === 'traits' ? 'variety' : category;
            
            // Render badges with selected category
            renderBadges(window.currentBadgeResults, mappedCategory);
        };
        
        // Set "All Badges" as active by default
        if (btn.getAttribute('data-category') === 'all' || btn.textContent.includes('All Badges')) {
            btn.classList.add('active');
        }
    });
}

// Initialize badge system
function initBadgeSystem(nfts) {
    console.log('Initializing badge system with', nfts.length, 'NFTs');
    
    // Preload emoji images for mobile first
    preloadBadgeEmojis();
    
    // Check if TRAIT_RARITIES is loaded (needed for rarity-based badges)
    if (!window.TRAIT_RARITIES) {
        console.warn('Badge system: TRAIT_RARITIES not loaded yet, waiting...');
        // Retry after a short delay
        setTimeout(() => initBadgeSystem(nfts), 100);
        return;
    }

    // Get current wallet address
    const walletAddress = window.currentWallet;
    if (!walletAddress) {
        console.error('Badge system: No wallet address found');
        return;
    }

    // Calculate badges (auto-unlocks new ones)
    const badgeResults = calculateBadges(nfts, walletAddress);
    window.currentBadgeResults = badgeResults;
    window.currentBadgeWallet = walletAddress;

    // Show badge system
    const container = document.getElementById('badgeSystemContainer');
    if (container) {
        container.style.display = 'block';
    }

    // Update header
    updateBadgeHeader(badgeResults);

    // Render badges
    renderBadges(badgeResults);

    // Setup category filters
    setupBadgeCategories();

    // Log newly earned badges to console (no popups)
    if (badgeResults.newQualified.length > 0) {
        console.log(`🎉 ${badgeResults.newQualified.length} new badges earned!`, badgeResults.newQualified);
    }
}

// Export functions to window
window.initBadgeSystem = initBadgeSystem;
window.toggleBadgePanel = toggleBadgePanel;
window.closeNotification = closeNotification;
window.cleanupConfetti = cleanupConfetti;
