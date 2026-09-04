import { Match } from '../models/Match.js';
import { Category } from '../models/Category.js';
import { Tournament } from '../models/Tournament.js';
import { advanceMatchResult } from '../services/bracketEngine.js';
import {
  emitMatchCalled,
  emitMatchStateChange,
  emitScoringUpdate,
  emitMatchCompleted,
  emitTableQueueUpdated,
} from '../services/socketService.js';

// @desc    Get matches with optional filters
// @route   GET /api/matches
// @access  Public
export const getMatches = async (req, res) => {
  try {
    const { tournamentId, categoryId, assignedTable, status, bracketType } = req.query;
    const filter = {};

    if (tournamentId) filter.tournamentId = tournamentId;
    if (categoryId) filter.categoryId = categoryId;
    if (assignedTable) filter.assignedTable = Number(assignedTable);
    if (status) filter.status = status;
    if (bracketType) filter.bracketType = bracketType;

    const matches = await Match.find(filter)
      .populate('athleteA', 'name club country officialWeightKg')
      .populate('athleteB', 'name club country officialWeightKg')
      .populate('winner', 'name club country')
      .populate('loser', 'name club country')
      .populate('categoryId', 'name arm weightClassLimitKg')
      .sort({ roundNumber: 1, matchIndex: 1 });

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching matches.',
      error: error.message,
    });
  }
};

// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Public
export const getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('athleteA', 'name club country officialWeightKg isWeighedIn')
      .populate('athleteB', 'name club country officialWeightKg isWeighedIn')
      .populate('winner', 'name club country')
      .populate('loser', 'name club country')
      .populate('categoryId', 'name arm weightClassLimitKg');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found.',
      });
    }

    return res.status(200).json({
      success: true,
      match,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching match.',
      error: error.message,
    });
  }
};

// @desc    Call match to a table (triggers 60s countdown clock)
// @route   PATCH /api/matches/:id/call
// @access  Private (Admin / Table Referee)
export const callMatchToTable = async (req, res) => {
  try {
    const { tableNumber } = req.body;

    if (!tableNumber) {
      return res.status(400).json({
        success: false,
        message: 'Table number is required to call a match.',
      });
    }

    const match = await Match.findById(req.params.id)
      .populate('athleteA', 'name club country')
      .populate('athleteB', 'name club country')
      .populate('categoryId', 'name arm');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found.',
      });
    }

    if (!match.athleteA || !match.athleteB) {
      return res.status(400).json({
        success: false,
        message: 'Cannot call a match before both competitors are determined.',
      });
    }

    match.assignedTable = Number(tableNumber);
    match.status = 'CALLED';
    match.callTime = new Date();

    const updatedMatch = await match.save();

    // Broadcast live socket event (60s countdown on displays)
    emitMatchCalled(match.tournamentId, {
      matchId: match._id,
      tableNumber: match.assignedTable,
      athleteA: match.athleteA,
      athleteB: match.athleteB,
      callTime: match.callTime,
      categoryName: match.categoryId ? match.categoryId.name : '',
      arm: match.categoryId ? match.categoryId.arm : '',
    });

    return res.status(200).json({
      success: true,
      message: `Match called to Table ${tableNumber}. 60s ready clock started.`,
      match: updatedMatch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error calling match to table.',
      error: error.message,
    });
  }
};

// @desc    Start match setup / grip on table
// @route   PATCH /api/matches/:id/start
// @access  Private (Admin / Table Referee)
export const startMatchOnTable = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found.',
      });
    }

    match.status = 'ON_TABLE';
    match.startedAt = new Date();

    const updatedMatch = await match.save();

    emitMatchStateChange(match.tournamentId, {
      matchId: match._id,
      status: 'ON_TABLE',
      assignedTable: match.assignedTable,
    });

    return res.status(200).json({
      success: true,
      message: 'Match is now active ON_TABLE.',
      match: updatedMatch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error starting match.',
      error: error.message,
    });
  }
};

// @desc    Update live referee touchpad scoring (fouls, warnings, straps, grip)
// @route   PATCH /api/matches/:id/score
// @access  Private (Table Referee / Admin)
export const updateLiveScore = async (req, res) => {
  try {
    let {
      athleteAFouls,
      athleteBFouls,
      athleteAWarnings,
      athleteBWarnings,
      wentToStraps,
      inRefereesGrip,
    } = req.body;

    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found.',
      });
    }

    // Apply Official WAF Rule: 2 Warnings = 1 Foul
    if (athleteAWarnings !== undefined) {
      if (athleteAWarnings >= 2) {
        athleteAFouls = (athleteAFouls !== undefined ? athleteAFouls : match.scoringData.athleteAFouls) + 1;
        athleteAWarnings = 0;
      }
      match.scoringData.athleteAWarnings = athleteAWarnings;
    }

    if (athleteBWarnings !== undefined) {
      if (athleteBWarnings >= 2) {
        athleteBFouls = (athleteBFouls !== undefined ? athleteBFouls : match.scoringData.athleteBFouls) + 1;
        athleteBWarnings = 0;
      }
      match.scoringData.athleteBWarnings = athleteBWarnings;
    }

    if (athleteAFouls !== undefined) match.scoringData.athleteAFouls = athleteAFouls;
    if (athleteBFouls !== undefined) match.scoringData.athleteBFouls = athleteBFouls;
    if (wentToStraps !== undefined) match.scoringData.wentToStraps = Boolean(wentToStraps);
    if (inRefereesGrip !== undefined) match.scoringData.inRefereesGrip = Boolean(inRefereesGrip);

    const updatedMatch = await match.save();

    // Broadcast live scoring update in sub-100ms
    emitScoringUpdate(match.tournamentId, {
      matchId: match._id,
      scoringData: match.scoringData,
    });

    return res.status(200).json({
      success: true,
      scoringData: updatedMatch.scoringData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating live score.',
      error: error.message,
    });
  }
};

// @desc    Complete match, record win method, and advance bracket pointers
// @route   POST /api/matches/:id/complete
// @access  Private (Table Referee / Admin)
export const completeMatch = async (req, res) => {
  try {
    const { winnerId, loserId, winMethod } = req.body;

    if (!winnerId || !loserId || !winMethod) {
      return res.status(400).json({
        success: false,
        message: 'Winner ID, Loser ID, and Win Method (PIN, FOULS, FORFEIT, DISQUALIFICATION) are required.',
      });
    }

    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found.',
      });
    }

    if (match.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Match has already been completed.',
      });
    }

    match.winner = winnerId;
    match.loser = loserId;
    match.scoringData.winMethod = winMethod;
    match.status = 'COMPLETED';
    match.completedAt = new Date();

    const updatedMatch = await match.save();

    // Advance tournament bracket tree and check for Grand Finals Reset
    const { grandFinalsResetCreated } = await advanceMatchResult(
      updatedMatch,
      winnerId,
      loserId,
    );

    // Broadcast match completion and bracket progression
    emitMatchCompleted(match.tournamentId, {
      matchId: match._id,
      winnerId,
      loserId,
      winMethod,
      bracketType: match.bracketType,
      grandFinalsResetCreated: grandFinalsResetCreated ? grandFinalsResetCreated._id : null,
    });

    return res.status(200).json({
      success: true,
      message: 'Match completed and bracket tree updated successfully.',
      match: updatedMatch,
      grandFinalsResetCreated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error completing match.',
      error: error.message,
    });
  }
};

// @desc    Get staged match queues per table (ON_TABLE, ON_DECK, IN_THE_HOLE)
// @route   GET /api/tournaments/:id/tables/queue
// @access  Public
export const getTableQueues = async (req, res) => {
  try {
    const tournamentId = req.params.id;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found.',
      });
    }

    const tablesCount = tournament.tablesCount || 2;
    const tableQueues = {};

    for (let tableNum = 1; tableNum <= tablesCount; tableNum++) {
      const activeOrCalled = await Match.findOne({
        tournamentId,
        assignedTable: tableNum,
        status: { $in: ['ON_TABLE', 'CALLED'] },
      })
        .populate('athleteA', 'name club country officialWeightKg')
        .populate('athleteB', 'name club country officialWeightKg')
        .populate('categoryId', 'name arm weightClassLimitKg');

      const upcoming = await Match.find({
        tournamentId,
        assignedTable: tableNum,
        status: 'WAITING',
      })
        .populate('athleteA', 'name club country officialWeightKg')
        .populate('athleteB', 'name club country officialWeightKg')
        .populate('categoryId', 'name arm weightClassLimitKg')
        .sort({ roundNumber: 1, matchIndex: 1 })
        .limit(2);

      tableQueues[`Table_${tableNum}`] = {
        tableNumber: tableNum,
        onTable: activeOrCalled || null,
        onDeck: upcoming[0] || null,
        inTheHole: upcoming[1] || null,
      };
    }

    return res.status(200).json({
      success: true,
      tournamentId,
      tablesCount,
      tableQueues,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching table staging queues.',
      error: error.message,
    });
  }
};
