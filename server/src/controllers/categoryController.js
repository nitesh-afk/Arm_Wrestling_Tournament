import { Category } from '../models/Category.js';
import { Tournament } from '../models/Tournament.js';
import { Athlete } from '../models/Athlete.js';
import { Match } from '../models/Match.js';
import { generateDoubleEliminationBracket } from '../services/bracketEngine.js';

// @desc    Create a new tournament category
// @route   POST /api/categories
// @access  Private (Admin only)
export const createCategory = async (req, res) => {
  try {
    const {
      tournamentId,
      name,
      arm,
      gender,
      division,
      weightClassLimitKg,
      isOpenWeight,
    } = req.body;

    if (!tournamentId || !name || !arm) {
      return res.status(400).json({
        success: false,
        message: 'Please provide tournamentId, name, and arm dominance (RIGHT/LEFT).',
      });
    }

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found.',
      });
    }

    const category = await Category.create({
      tournamentId,
      name,
      arm,
      gender: gender || 'MEN',
      division: division || 'SENIOR',
      weightClassLimitKg: isOpenWeight ? null : weightClassLimitKg,
      isOpenWeight: isOpenWeight || false,
    });

    // Link category to tournament
    await Tournament.findByIdAndUpdate(tournamentId, {
      $addToSet: { categories: category._id },
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating category.',
      error: error.message,
    });
  }
};

// @desc    Get all categories for a tournament
// @route   GET /api/categories?tournamentId=...
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const { tournamentId, arm, gender, division } = req.query;
    const filter = {};

    if (tournamentId) filter.tournamentId = tournamentId;
    if (arm) filter.arm = arm;
    if (gender) filter.gender = gender;
    if (division) filter.division = division;

    const categories = await Category.find(filter)
      .populate('athletes', 'name club country officialWeightKg isWeighedIn')
      .populate('podium.gold', 'name club country')
      .populate('podium.silver', 'name club country')
      .populate('podium.bronze', 'name club country')
      .populate('podium.fourth', 'name club country')
      .sort({ weightClassLimitKg: 1, name: 1 });

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching categories.',
      error: error.message,
    });
  }
};

// @desc    Get single category by ID with populated athletes and matches
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('athletes', 'name club country officialWeightKg isWeighedIn armDominance')
      .populate({
        path: 'matches',
        populate: [
          { path: 'athleteA', select: 'name club country' },
          { path: 'athleteB', select: 'name club country' },
          { path: 'winner', select: 'name club country' },
          { path: 'loser', select: 'name club country' },
        ],
      })
      .populate('podium.gold', 'name club country')
      .populate('podium.silver', 'name club country')
      .populate('podium.bronze', 'name club country')
      .populate('podium.fourth', 'name club country');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching category details.',
      error: error.message,
    });
  }
};

// @desc    Assign an athlete to a category
// @route   POST /api/categories/:id/athletes
// @access  Private (Admin / Official)
export const assignAthleteToCategory = async (req, res) => {
  try {
    const { athleteId } = req.body;
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    if (category.bracketStatus !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify athlete roster after bracket generation is locked.',
      });
    }

    const athlete = await Athlete.findById(athleteId);
    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found.',
      });
    }

    // Add athlete to category
    await Category.findByIdAndUpdate(categoryId, {
      $addToSet: { athletes: athleteId },
    });

    // Add category to athlete
    await Athlete.findByIdAndUpdate(athleteId, {
      $addToSet: { registeredCategories: categoryId },
    });

    const updatedCategory = await Category.findById(categoryId).populate(
      'athletes',
      'name club country officialWeightKg isWeighedIn',
    );

    return res.status(200).json({
      success: true,
      message: `Athlete ${athlete.name} assigned to category ${category.name}.`,
      category: updatedCategory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error assigning athlete to category.',
      error: error.message,
    });
  }
};

// @desc    Remove an athlete from a category
// @route   DELETE /api/categories/:id/athletes/:athleteId
// @access  Private (Admin only)
export const removeAthleteFromCategory = async (req, res) => {
  try {
    const { id: categoryId, athleteId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    if (category.bracketStatus !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify athlete roster after bracket generation is locked.',
      });
    }

    await Category.findByIdAndUpdate(categoryId, {
      $pull: { athletes: athleteId },
    });

    await Athlete.findByIdAndUpdate(athleteId, {
      $pull: { registeredCategories: categoryId },
    });

    return res.status(200).json({
      success: true,
      message: 'Athlete removed from category successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error removing athlete from category.',
      error: error.message,
    });
  }
};

// @desc    Get podium results for a finalized category
// @route   GET /api/categories/:id/podium
// @access  Public
export const getPodium = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .select('name arm gender division bracketStatus podium')
      .populate('podium.gold', 'name club country officialWeightKg')
      .populate('podium.silver', 'name club country officialWeightKg')
      .populate('podium.bronze', 'name club country officialWeightKg')
      .populate('podium.fourth', 'name club country officialWeightKg');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    return res.status(200).json({
      success: true,
      categoryName: category.name,
      arm: category.arm,
      bracketStatus: category.bracketStatus,
      podium: category.podium,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching podium results.',
      error: error.message,
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    // Remove from tournament
    await Tournament.findByIdAndUpdate(category.tournamentId, {
      $pull: { categories: category._id },
    });

    // Remove from registered athletes
    await Athlete.updateMany(
      { registeredCategories: category._id },
      { $pull: { registeredCategories: category._id } },
    );

    await category.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting category.',
      error: error.message,
    });
  }
};

// @desc    Generate WAF/IFA Double-Elimination bracket for a category
// @route   POST /api/categories/:id/generate-bracket
// @access  Private (Admin only)
export const generateCategoryBracket = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId).populate('athletes');
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    if (category.bracketStatus !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Bracket is already ${category.bracketStatus}. Reset required to regenerate.`,
      });
    }

    if (!category.athletes || category.athletes.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 registered athletes are required to generate a bracket.',
      });
    }

    // Extract athlete IDs
    const athleteIds = category.athletes.map((a) => a._id);

    // Run bracket generator algorithm
    const matches = await generateDoubleEliminationBracket(
      categoryId,
      category.tournamentId,
      athleteIds,
    );

    return res.status(201).json({
      success: true,
      message: `Successfully generated WAF/IFA double-elimination bracket with ${matches.length} matches.`,
      matchesCount: matches.length,
      categoryStatus: 'GENERATED',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error generating category bracket.',
      error: error.message,
    });
  }
};

// @desc    Get complete visual bracket tree for a category
// @route   GET /api/categories/:id/bracket
// @access  Public
export const getCategoryBracketTree = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId)
      .populate('podium.gold', 'name club country')
      .populate('podium.silver', 'name club country')
      .populate('podium.bronze', 'name club country')
      .populate('podium.fourth', 'name club country');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const matches = await Match.find({ categoryId })
      .populate('athleteA', 'name club country officialWeightKg')
      .populate('athleteB', 'name club country officialWeightKg')
      .populate('winner', 'name club country')
      .populate('loser', 'name club country')
      .sort({ roundNumber: 1, matchIndex: 1 });

    // Group matches by bracket type and round
    const winnersBracket = {};
    const losersBracket = {};
    let grandFinals = null;
    let grandFinalsReset = null;

    matches.forEach((m) => {
      if (m.bracketType === 'WINNERS_BRACKET') {
        if (!winnersBracket[m.roundNumber]) {
          winnersBracket[m.roundNumber] = [];
        }
        winnersBracket[m.roundNumber].push(m);
      } else if (m.bracketType === 'LOSERS_BRACKET') {
        if (!losersBracket[m.roundNumber]) {
          losersBracket[m.roundNumber] = [];
        }
        losersBracket[m.roundNumber].push(m);
      } else if (m.bracketType === 'GRAND_FINALS') {
        grandFinals = m;
      } else if (m.bracketType === 'GRAND_FINALS_RESET') {
        grandFinalsReset = m;
      }
    });

    return res.status(200).json({
      success: true,
      category: {
        _id: category._id,
        name: category.name,
        arm: category.arm,
        gender: category.gender,
        division: category.division,
        bracketStatus: category.bracketStatus,
        podium: category.podium,
      },
      bracket: {
        winnersBracket,
        losersBracket,
        grandFinals,
        grandFinalsReset,
        totalMatches: matches.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching category bracket tree.',
      error: error.message,
    });
  }
};

