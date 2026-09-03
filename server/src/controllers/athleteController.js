import { Athlete } from '../models/Athlete.js';
import { Category } from '../models/Category.js';

// @desc    Register a new athlete
// @route   POST /api/athletes
// @access  Public / Organizer
export const registerAthlete = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      club,
      country,
      armDominance,
      registeredCategories,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Athlete name is required.',
      });
    }

    const athlete = await Athlete.create({
      name,
      phone,
      email,
      club: club || 'Independent',
      country: country || 'Nepal',
      armDominance: armDominance || 'RIGHT',
      registeredCategories: registeredCategories || [],
    });

    // If registered categories were provided, link the athlete in Category documents
    if (registeredCategories && registeredCategories.length > 0) {
      await Category.updateMany(
        { _id: { $in: registeredCategories } },
        { $addToSet: { athletes: athlete._id } },
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Athlete registered successfully.',
      athlete,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error registering athlete.',
      error: error.message,
    });
  }
};

// @desc    Get all athletes with optional filtering & search
// @route   GET /api/athletes
// @access  Public
export const getAllAthletes = async (req, res) => {
  try {
    const { search, isWeighedIn, armDominance, categoryId } = req.query;
    const filter = {};

    if (isWeighedIn !== undefined) {
      filter.isWeighedIn = isWeighedIn === 'true';
    }

    if (armDominance) {
      filter.armDominance = armDominance;
    }

    if (categoryId) {
      filter.registeredCategories = categoryId;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { club: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
      ];
    }

    const athletes = await Athlete.find(filter)
      .populate('registeredCategories', 'name arm weightClassLimitKg')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: athletes.length,
      athletes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching athletes.',
      error: error.message,
    });
  }
};

// @desc    Get athlete by ID
// @route   GET /api/athletes/:id
// @access  Public
export const getAthleteById = async (req, res) => {
  try {
    const athlete = await Athlete.findById(req.params.id).populate(
      'registeredCategories',
      'name arm weightClassLimitKg bracketStatus',
    );

    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found.',
      });
    }

    return res.status(200).json({
      success: true,
      athlete,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching athlete profile.',
      error: error.message,
    });
  }
};

// @desc    Update athlete profile
// @route   PATCH /api/athletes/:id
// @access  Private (Admin / Official)
export const updateAthlete = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      club,
      country,
      armDominance,
      registeredCategories,
    } = req.body;

    const athlete = await Athlete.findById(req.params.id);

    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found.',
      });
    }

    if (name) athlete.name = name;
    if (phone !== undefined) athlete.phone = phone;
    if (email !== undefined) athlete.email = email;
    if (club !== undefined) athlete.club = club;
    if (country !== undefined) athlete.country = country;
    if (armDominance) athlete.armDominance = armDominance;

    if (registeredCategories) {
      // Unlink previous categories
      await Category.updateMany(
        { athletes: athlete._id },
        { $pull: { athletes: athlete._id } },
      );

      // Link newly assigned categories
      athlete.registeredCategories = registeredCategories;
      if (registeredCategories.length > 0) {
        await Category.updateMany(
          { _id: { $in: registeredCategories } },
          { $addToSet: { athletes: athlete._id } },
        );
      }
    }

    const updatedAthlete = await athlete.save();

    return res.status(200).json({
      success: true,
      message: 'Athlete profile updated successfully.',
      athlete: updatedAthlete,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating athlete profile.',
      error: error.message,
    });
  }
};

// @desc    Record official digital scale weigh-in clearance
// @route   PATCH /api/athletes/:id/weigh-in
// @access  Private (Admin / Table Referee)
export const recordWeighIn = async (req, res) => {
  try {
    const { officialWeightKg, registeredCategories } = req.body;

    if (officialWeightKg === undefined || officialWeightKg === null) {
      return res.status(400).json({
        success: false,
        message: 'Official weight in kilograms is required.',
      });
    }

    const athlete = await Athlete.findById(req.params.id);

    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found.',
      });
    }

    athlete.officialWeightKg = Number(officialWeightKg);
    athlete.isWeighedIn = true;

    // If updated categories provided during weigh-in desk clearance
    if (registeredCategories) {
      await Category.updateMany(
        { athletes: athlete._id },
        { $pull: { athletes: athlete._id } },
      );

      athlete.registeredCategories = registeredCategories;
      if (registeredCategories.length > 0) {
        await Category.updateMany(
          { _id: { $in: registeredCategories } },
          { $addToSet: { athletes: athlete._id } },
        );
      }
    }

    const updatedAthlete = await athlete.save();
    await updatedAthlete.populate(
      'registeredCategories',
      'name arm weightClassLimitKg',
    );

    return res.status(200).json({
      success: true,
      message: `Athlete ${athlete.name} weighed in at ${officialWeightKg}kg and cleared for competition.`,
      athlete: updatedAthlete,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error recording athlete weigh-in.',
      error: error.message,
    });
  }
};

// @desc    Delete athlete
// @route   DELETE /api/athletes/:id
// @access  Private (Admin only)
export const deleteAthlete = async (req, res) => {
  try {
    const athlete = await Athlete.findById(req.params.id);

    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found.',
      });
    }

    // Clean up category references
    await Category.updateMany(
      { athletes: athlete._id },
      { $pull: { athletes: athlete._id } },
    );

    await athlete.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Athlete deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting athlete.',
      error: error.message,
    });
  }
};
