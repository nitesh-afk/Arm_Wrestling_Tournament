import { Tournament } from '../models/Tournament.js';

// @desc    Create a new tournament
// @route   POST /api/tournaments
// @access  Private (Admin only)
export const createTournament = async (req, res) => {
  try {
    const { name, venue, eventDate, tablesCount } = req.body;

    if (!name || !venue || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide tournament name, venue, and event date.',
      });
    }

    const tournament = await Tournament.create({
      name,
      venue,
      eventDate,
      tablesCount: tablesCount || 2,
      createdBy: req.user ? req.user._id : null,
    });

    return res.status(201).json({
      success: true,
      message: 'Tournament created successfully.',
      tournament,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating tournament.',
      error: error.message,
    });
  }
};

// @desc    Get all tournaments with optional status filter
// @route   GET /api/tournaments
// @access  Public
export const getAllTournaments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const tournaments = await Tournament.find(filter)
      .populate('categories', 'name arm weightClassLimitKg bracketStatus')
      .populate('createdBy', 'username email')
      .sort({ eventDate: -1 });

    return res.status(200).json({
      success: true,
      count: tournaments.length,
      tournaments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching tournaments.',
      error: error.message,
    });
  }
};

// @desc    Get single tournament by ID with populated categories
// @route   GET /api/tournaments/:id
// @access  Public
export const getTournamentById = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate({
        path: 'categories',
        populate: {
          path: 'athletes',
          select: 'name club country officialWeightKg isWeighedIn',
        },
      })
      .populate('createdBy', 'username email');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found.',
      });
    }

    return res.status(200).json({
      success: true,
      tournament,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching tournament details.',
      error: error.message,
    });
  }
};

// @desc    Update tournament metadata or lifecycle status
// @route   PATCH /api/tournaments/:id
// @access  Private (Admin only)
export const updateTournament = async (req, res) => {
  try {
    const { name, venue, eventDate, tablesCount, status } = req.body;

    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found.',
      });
    }

    if (name) tournament.name = name;
    if (venue) tournament.venue = venue;
    if (eventDate) tournament.eventDate = eventDate;
    if (tablesCount !== undefined) tournament.tablesCount = tablesCount;
    if (status) tournament.status = status;

    const updatedTournament = await tournament.save();

    return res.status(200).json({
      success: true,
      message: 'Tournament updated successfully.',
      tournament: updatedTournament,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating tournament.',
      error: error.message,
    });
  }
};

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private (Admin only)
export const deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found.',
      });
    }

    await tournament.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting tournament.',
      error: error.message,
    });
  }
};
