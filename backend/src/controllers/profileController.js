const profileService = require("../services/profileService");
const { sendSuccess } = require("../utils/apiResponse");

exports.getOwn = async (req, res, next) => {
  try {
    return sendSuccess(res, { data: await profileService.getOwnProfile(req.user) });
  } catch (error) {
    return next(error);
  }
};

exports.updateOwn = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      data: await profileService.updateOwnProfile(req.user, req.body),
      message: "Profile saved",
    });
  } catch (error) {
    return next(error);
  }
};

exports.completeOnboarding = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      data: await profileService.updateOwnProfile(
        req.user,
        { ...req.body, onboardingCompleted: true },
        { onboarding: true },
      ),
      message: "Profile onboarding complete",
    });
  } catch (error) {
    return next(error);
  }
};

exports.checkUsername = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      data: await profileService.checkUsername(req.query.username, req.user.id),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getPublic = async (req, res, next) => {
  try {
    return sendSuccess(res, { data: await profileService.getPublicProfile(req.params.username) });
  } catch (error) {
    return next(error);
  }
};

exports.searchSkills = async (req, res, next) => {
  try {
    return sendSuccess(res, { data: await profileService.searchSkills(req.query) });
  } catch (error) {
    return next(error);
  }
};

exports.createEducation = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      status: 201,
      data: await profileService.createEducation(req.user.id, req.body),
      message: "Education added",
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateEducation = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      data: await profileService.updateEducation(req.user.id, req.params.id, req.body),
      message: "Education updated",
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteEducation = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      data: await profileService.deleteEducation(req.user.id, req.params.id),
      message: "Education removed",
    });
  } catch (error) {
    return next(error);
  }
};

exports.replaceSkills = async (req, res, next) => {
  try {
    return sendSuccess(res, {
      data: await profileService.replaceSkills(req.user, req.body.skills),
      message: "Skills saved",
    });
  } catch (error) {
    return next(error);
  }
};
