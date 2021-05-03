const User = require("../../models/User");
const { validatePassword, issueJWT, genPassword } = require("../../../lib/utils");
const getIdFromToken = require("../../../lib/getIdFromToken");
const Joi = require("joi");

const getCurrentUser = (req, res) => {
  const id = getIdFromToken(req.headers.authorization);
  User.findByPk(id)
    .then((user) => {
      if (!user) return res.send({ success: false, msg: "User not found." });
      const data = {
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        organization: user.organization,
      };
      res.send({ success: true, data: data });
    })
    .catch((err) => res.send({ success: false, msg: "There was an error.", error: err }));
};

const updateCurrentUser = (req, res, next) => {
  const validationError = validateUpdate(req.body);
  if (validationError) return res.send({ success: false, msg: validationError.details[0].message });

  const id = getIdFromToken(req.headers.authorization);
  User.findByPk(id)
    .then((user) => {
      if (!user) return res.send({ success: false, msg: "User not found." });
      user
        .update(req.body)
        .then((result) => {
          const data = {
            username: result.username,
            firstname: result.firstname,
            lastname: result.lastname,
            email: result.email,
            organization: result.organization,
          };
          res.send({ success: true, data: data });
        })
        .catch((err) => res.send({ success: false, msg: "There was an error.", error: err }));
    })
    .catch((err) => res.send({ success: false, msg: "There was an error.", error: err }));
};

const deleteCurrentUser = (req, res, next) => {
  const id = getIdFromToken(req.headers.authorization);
  User.findByPk(id)
    .then((user) => {
      if (!user) return res.send({ success: false, msg: "User not found." });
      if (!req.body.password || req.body.password.length === 0) return res.send({ success: false, msg: "Please enter a password." });
      const isValid = validatePassword(req.body.password, user.hash, user.salt);
      if (isValid) {
        user
          .destroy()
          .then(() => res.send({ success: true, data: "User has been deleted successfully!" }))
          .catch((err) => res.send({ success: false, msg: "There was an error.", error: err }));
      } else {
        res.send({ success: false, msg: "You have entered a wrong password." });
      }
    })
    .catch((err) => res.send({ success: false, msg: "There was an error.", error: err }));
};

const validateUpdate = (data) => {
  const schema = Joi.object({
    firstname: Joi.string().min(1).optional(),
    lastname: Joi.string().min(1).optional(),
    username: Joi.string().min(1).optional(),
    email: Joi.string().min(1).email().optional(),
    organization: Joi.string().empty("").default("").optional(),
  });

  const { error } = schema.validate(data);
  return error;
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
};