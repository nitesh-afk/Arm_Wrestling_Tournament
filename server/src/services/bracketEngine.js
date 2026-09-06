import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { Category } from '../models/Category.js';

/**
 * Calculates the next power of 2 greater than or equal to n (minimum 4).
 * @param {number} n - Number of participants
 * @returns {number} Bracket power of 2 size (4, 8, 16, 32, 64, 128)
 */
export const getNextPowerOfTwo = (n) => {
  let power = 4;
  while (power < n) {
    power *= 2;
  }
  return power;
};

/**
 * Standard tournament seed pairing order generator.
 * For N=8, order: [1, 8, 4, 5, 2, 7, 3, 6] -> pairs (1vs8), (4vs5), (2vs7), (3vs6)
 * @param {number} numParticipants - Power of 2 count
 * @returns {number[]} Array of seed indices
 */
export const generateSeedOrder = (numParticipants) => {
  let rounds = Math.log2(numParticipants) - 1;
  let pls = [1, 2];
  for (let i = 0; i < rounds; i++) {
    let nextPls = [];
    const sum = pls.length * 2 + 1;
    for (const p of pls) {
      nextPls.push(p);
      nextPls.push(sum - p);
    }
    pls = nextPls;
  }
  return pls;
};

/**
 * Generates an official WAF/IFA Double-Elimination bracket graph for a Category.
 * Creates all Winners Bracket, Losers Bracket, and Grand Finals match nodes with pointer linkages.
 * 
 * @param {string} categoryId - ID of Category
 * @param {string} tournamentId - ID of Tournament
 * @param {Array<string>} athleteIds - List of registered/weighed-in athlete IDs
 * @returns {Promise<Array<Object>>} Array of created Match documents
 */
export const generateDoubleEliminationBracket = async (
  categoryId,
  tournamentId,
  athleteIds,
) => {
  if (!athleteIds || athleteIds.length < 2) {
    throw new Error('At least 2 athletes are required to generate a tournament bracket.');
  }

  const numAthletes = athleteIds.length;
  const bracketSize = getNextPowerOfTwo(numAthletes);
  const numByes = bracketSize - numAthletes;
  const totalWBRounds = Math.log2(bracketSize);

  // Shuffle or seed athletes (athletes[0] is seed 1, etc.)
  const seeds = generateSeedOrder(bracketSize);
  const seededAthletes = new Array(bracketSize).fill(null);

  // Distribute athletes to seeds; seeds > numAthletes become Byes (null)
  seeds.forEach((seedNum, index) => {
    if (seedNum <= numAthletes) {
      seededAthletes[index] = athleteIds[seedNum - 1];
    } else {
      seededAthletes[index] = null; // Bye slot
    }
  });

  // Pre-instantiate match ObjectIds so pointers can be linked before DB persistence
  const wbMatches = []; // 2D array: wbMatches[roundIndex][matchIndex]
  const lbMatches = []; // 2D array: lbMatches[roundIndex][matchIndex]
  let grandFinalsMatchId = new mongoose.Types.ObjectId();

  // 1. Create Winners Bracket Skeleton
  for (let r = 0; r < totalWBRounds; r++) {
    const roundMatchCount = bracketSize / Math.pow(2, r + 1);
    wbMatches[r] = [];

    for (let m = 0; m < roundMatchCount; m++) {
      wbMatches[r][m] = {
        _id: new mongoose.Types.ObjectId(),
        tournamentId,
        categoryId,
        bracketType: 'WINNERS_BRACKET',
        roundNumber: r + 1,
        matchIndex: m + 1,
        athleteA: null,
        athleteB: null,
        winner: null,
        loser: null,
        nextWinnerMatchId: null,
        nextLoserMatchId: null,
        status: 'WAITING',
      };
    }
  }

  // 2. Populate Round 1 Winners Bracket with seeded athletes / byes
  for (let m = 0; m < wbMatches[0].length; m++) {
    const athleteA = seededAthletes[m * 2];
    const athleteB = seededAthletes[m * 2 + 1];

    wbMatches[0][m].athleteA = athleteA;
    wbMatches[0][m].athleteB = athleteB;

    // If one side is a Bye, auto-advance the real athlete
    if (athleteA && !athleteB) {
      wbMatches[0][m].winner = athleteA;
      wbMatches[0][m].status = 'BYE';
    } else if (!athleteA && athleteB) {
      wbMatches[0][m].winner = athleteB;
      wbMatches[0][m].status = 'BYE';
    }
  }

  // 3. Link Winners Bracket Forward Pointers (nextWinnerMatchId)
  for (let r = 0; r < totalWBRounds - 1; r++) {
    for (let m = 0; m < wbMatches[r].length; m++) {
      const nextMatch = wbMatches[r + 1][Math.floor(m / 2)];
      wbMatches[r][m].nextWinnerMatchId = nextMatch._id;

      // If current match was a Bye, propagate winner to next round immediately
      if (wbMatches[r][m].status === 'BYE') {
        const slot = m % 2 === 0 ? 'athleteA' : 'athleteB';
        nextMatch[slot] = wbMatches[r][m].winner;
      }
    }
  }

  // Winners Bracket Final links to Grand Finals
  const wbFinal = wbMatches[totalWBRounds - 1][0];
  wbFinal.nextWinnerMatchId = grandFinalsMatchId;

  // 4. Create Losers Bracket Skeleton
  // Total Losers Bracket rounds = 2 * (totalWBRounds - 1)
  const totalLBRounds = 2 * (totalWBRounds - 1);
  let currentLBMatchCount = bracketSize / 4;

  for (let r = 0; r < totalLBRounds; r++) {
    lbMatches[r] = [];

    for (let m = 0; m < currentLBMatchCount; m++) {
      lbMatches[r][m] = {
        _id: new mongoose.Types.ObjectId(),
        tournamentId,
        categoryId,
        bracketType: 'LOSERS_BRACKET',
        roundNumber: r + 1,
        matchIndex: m + 1,
        athleteA: null,
        athleteB: null,
        winner: null,
        loser: null,
        nextWinnerMatchId: null,
        nextLoserMatchId: null, // Losers of Losers bracket are eliminated
        status: 'WAITING',
      };
    }

    // Match count halves every 2 rounds in losers bracket
    if (r % 2 === 1) {
      currentLBMatchCount = currentLBMatchCount / 2;
    }
  }

  // 5. Link Winners Bracket Drop-Downs to Losers Bracket (nextLoserMatchId)
  // Round 1 WB losers drop to Round 1 LB
  for (let m = 0; m < wbMatches[0].length; m++) {
    const targetLB = lbMatches[0][Math.floor(m / 2)];
    wbMatches[0][m].nextLoserMatchId = targetLB._id;
  }

  // WB Round 2+ losers drop into alternating Losers Bracket rounds
  for (let r = 1; r < totalWBRounds; r++) {
    const targetLBRoundIndex = (r - 1) * 2 + 1; // Round 2 -> LB R2, Round 3 -> LB R4, etc.
    if (lbMatches[targetLBRoundIndex]) {
      for (let m = 0; m < wbMatches[r].length; m++) {
        // Reverse indexing prevents immediate rematches in early rounds
        const targetMatchIndex = wbMatches[r].length - 1 - m;
        const targetLB = lbMatches[targetLBRoundIndex][targetMatchIndex];
        if (targetLB) {
          wbMatches[r][m].nextLoserMatchId = targetLB._id;
        }
      }
    }
  }

  // 6. Link Losers Bracket Progression Pointers
  for (let r = 0; r < totalLBRounds - 1; r++) {
    const isEvenRound = r % 2 === 0; // 0-indexed (LB Round 1, Round 3, etc.)
    for (let m = 0; m < lbMatches[r].length; m++) {
      const nextLBMatchIndex = isEvenRound ? m : Math.floor(m / 2);
      const nextLB = lbMatches[r + 1][nextLBMatchIndex];
      lbMatches[r][m].nextWinnerMatchId = nextLB._id;
    }
  }

  // Losers Bracket Final winner advances to Grand Finals
  const lbFinal = lbMatches[totalLBRounds - 1][0];
  lbFinal.nextWinnerMatchId = grandFinalsMatchId;

  // 7. Create Grand Finals Match
  const grandFinalsMatch = {
    _id: grandFinalsMatchId,
    tournamentId,
    categoryId,
    bracketType: 'GRAND_FINALS',
    roundNumber: totalWBRounds + 1,
    matchIndex: 1,
    athleteA: null, // Will receive Undefeated Winners Bracket Champion
    athleteB: null, // Will receive Losers Bracket Champion
    winner: null,
    loser: null,
    nextWinnerMatchId: null,
    nextLoserMatchId: null,
    status: 'WAITING',
  };

  // Flatten all match objects for batch insertion
  const allMatchesToCreate = [];
  wbMatches.forEach((round) => round.forEach((match) => allMatchesToCreate.push(match)));
  lbMatches.forEach((round) => round.forEach((match) => allMatchesToCreate.push(match)));
  allMatchesToCreate.push(grandFinalsMatch);

  // Persist all matches to MongoDB
  const createdMatches = await Match.insertMany(allMatchesToCreate);

  // Update Category status to GENERATED and store match references
  const matchIds = createdMatches.map((m) => m._id);
  await Category.findByIdAndUpdate(categoryId, {
    bracketStatus: 'GENERATED',
    matches: matchIds,
  });

  return createdMatches;
};

/**
 * Handles match progression when a match is completed.
 * Advances winner along nextWinnerMatchId, drops loser along nextLoserMatchId,
 * and instantiates GRAND_FINALS_RESET if the B-side winner defeats the A-side champion in Match 1.
 * 
 * @param {Object} match - The completed match document
 * @param {string} winnerId - ID of winning athlete
 * @param {string} loserId - ID of losing athlete
 * @returns {Promise<Object>} Object containing progression results
 */
export const advanceMatchResult = async (match, winnerId, loserId) => {
  let grandFinalsResetCreated = null;

  // 1. Advance Winner along nextWinnerMatchId
  if (match.nextWinnerMatchId) {
    const nextMatch = await Match.findById(match.nextWinnerMatchId);
    if (nextMatch) {
      if (!nextMatch.athleteA) {
        nextMatch.athleteA = winnerId;
      } else if (!nextMatch.athleteB) {
        nextMatch.athleteB = winnerId;
      }
      await nextMatch.save();
    }
  }

  // 2. Drop Loser along nextLoserMatchId (if dropping to Losers Bracket)
  if (match.nextLoserMatchId) {
    const loserNextMatch = await Match.findById(match.nextLoserMatchId);
    if (loserNextMatch) {
      if (!loserNextMatch.athleteA) {
        loserNextMatch.athleteA = loserId;
      } else if (!loserNextMatch.athleteB) {
        loserNextMatch.athleteB = loserId;
      }
      await loserNextMatch.save();
    }
  }

  // 3. Grand Finals Reset Logic
  // If Grand Finals Match (athleteA = undefeated WB winner, athleteB = LB winner)
  // and athleteB (1 loss) beats athleteA (undefeated) -> Instantiate Grand Finals Reset Supermatch
  if (match.bracketType === 'GRAND_FINALS') {
    const isLBWinnerVictory = String(winnerId) === String(match.athleteB);

    if (isLBWinnerVictory) {
      // Both now have 1 loss. True double elimination requires a Rematch.
      const resetMatch = await Match.create({
        tournamentId: match.tournamentId,
        categoryId: match.categoryId,
        bracketType: 'GRAND_FINALS_RESET',
        roundNumber: match.roundNumber + 1,
        matchIndex: 1,
        athleteA: match.athleteA,
        athleteB: match.athleteB,
        winner: null,
        loser: null,
        status: 'WAITING',
      });

      // Link newly created reset match to category
      await Category.findByIdAndUpdate(match.categoryId, {
        $push: { matches: resetMatch._id },
      });

      grandFinalsResetCreated = resetMatch;
    } else {
      // Undefeated A-Side Champion won Match 1 -> Category Finalized
      await resolvePodium(match.categoryId, winnerId, loserId);
    }
  } else if (match.bracketType === 'GRAND_FINALS_RESET') {
    // Winner of Reset takes 1st (Gold), Loser takes 2nd (Silver)
    await resolvePodium(match.categoryId, winnerId, loserId);
  }

  return {
    match,
    grandFinalsResetCreated,
  };
};

/**
 * Resolves and persists official podium results for a Category:
 * Gold (1st), Silver (2nd), Bronze (3rd), Fourth (4th).
 * 
 * @param {string} categoryId - Category ID
 * @param {string} goldAthleteId - 1st place athlete ID
 * @param {string} silverAthleteId - 2nd place athlete ID
 */
export const resolvePodium = async (categoryId, goldAthleteId, silverAthleteId) => {
  // Find Bronze (3rd place) = Loser of Losers Bracket Final
  const lbFinal = await Match.findOne({
    categoryId,
    bracketType: 'LOSERS_BRACKET',
  }).sort({ roundNumber: -1, matchIndex: -1 });

  const bronzeAthleteId = lbFinal ? lbFinal.loser : null;

  // Find 4th place = Loser of Losers Bracket Semi-Final (Round before LB Final)
  let fourthAthleteId = null;
  if (lbFinal && lbFinal.roundNumber > 1) {
    const lbSemi = await Match.findOne({
      categoryId,
      bracketType: 'LOSERS_BRACKET',
      roundNumber: lbFinal.roundNumber - 1,
    });
    fourthAthleteId = lbSemi ? lbSemi.loser : null;
  }

  await Category.findByIdAndUpdate(categoryId, {
    bracketStatus: 'FINALIZED',
    podium: {
      gold: goldAthleteId,
      silver: silverAthleteId,
      bronze: bronzeAthleteId,
      fourth: fourthAthleteId,
    },
  });
};
