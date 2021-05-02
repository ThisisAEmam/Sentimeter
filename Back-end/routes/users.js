const router = require("express").Router();
const pool = require("../config/database");
const passport = require("passport");
const { validatePassword, issueJWT, genPassword } = require("../lib/utils");
const Joi = require("joi");
const getIdFromToken = require("../lib/getIdFromToken");
const getPUTQuery = require("../lib/putQuery");

const emailRegex = /^([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)$/;

// RETURN THE CURRENT USER
router.get("/", passport.authenticate("admin", { session: false }), (req, res, next) => {
  pool
    .query("SELECT * FROM users")
    .then((response) => {
      if (response.rowCount === 0) return res.send({ success: false, msg: "We have no users right now." });
      const users = response.rows;
      res.send({ success: true, data: users });
    })
    .catch((err) => res.send({ success: false, msg: err }));
});

router.get("/me", passport.authenticate("user", { session: false }), (req, res, next) => {
  const id = getIdFromToken(req.headers.authorization);
  pool
    .query("SELECT * FROM users WHERE uid = $1", [id])
    .then((users) => {
      if (users.rowCount === 0) return res.send({ success: false, msg: `There is no user with id = ${id} registered in our database.` });
      const user = users.rows[0];
      res.send({ success: true, data: user });
    })
    .catch((err) => res.send({ success: false, msg: err }));
});

router.post("/login", (req, res, next) => {
  let query = "";
  if (emailRegex.test(req.body.username)) {
    query = "SELECT * FROM users WHERE email = $1";
  } else {
    query = "SELECT * FROM users WHERE username = $1";
  }

  pool
    .query(query, [req.body.username])
    .then((users) => {
      if (users.rowCount === 0) return res.send({ success: false, msg: "This username/email is not registered in our database." });
      const user = users.rows[0];
      const isValid = validatePassword(req.body.password, user.hash, user.salt);

      if (isValid) {
        const tokenObject = issueJWT(user);
        res.send({ success: true, user: user, token: tokenObject.token, expiresIn: tokenObject.expires });
      } else {
        res.send({ success: false, msg: "You have entered a wrong password." });
      }
    })
    .catch((err) => res.send({ success: false, msg: err }));
});

// Register a new user
router.post("/signup", (req, res, next) => {
  const validationError = validateRegister(req.body);
  if (validationError) return res.send({ success: false, msg: validationError.details[0].message });

  const { firstName, lastName, username, email, organization } = req.body;
  const { salt, hash } = genPassword(req.body.password);
  pool
    .query("INSERT INTO users (firstName, lastName, username, email, organization, hash, salt) VALUES($1, $2, $3, $4, $5, $6, $7);", [
      firstName,
      lastName,
      username,
      email,
      organization,
      hash,
      salt,
    ])
    .then((response) => {
      res.send({ success: true, msg: req.body });
    })
    .catch((err) => res.send({ success: false, msg: err }));
});

router.put("/me", passport.authenticate("user", { session: false }), (req, res, next) => {
  const id = getIdFromToken(req.headers.authorization);
  const { query, colsArr } = getPUTQuery("users", req.body, "uid", id);

  pool
    .query(query, colsArr)
    .then((response) => {
      res.send({ success: true, msg: `All changes have been saved!` });
    })
    .catch((err) => res.send({ success: false, msg: err }));
});

router.delete("/me", passport.authenticate("user", { session: false }), (req, res, next) => {
  const id = getIdFromToken(req.headers.authorization);
  pool
    .query("SELECT * FROM users WHERE uid = $1", [id])
    .then((response) => {
      const user = response.rows[0];
      const isValid = validatePassword(req.body.password, user.hash, user.salt);

      if (isValid) {
        pool
          .query("DELETE FROM users WHERE uid = $1", [id])
          .then((resp) => {
            res.send({ success: true, msg: "User has been deleted successfully!", user: user });
          })
          .catch((err) => res.send({ success: false, msg: err }));
      } else {
        res.send({ success: false, msg: "You have entered a wrong password." });
      }
      // res.send({ success: true, data:  });
    })
    .catch((err) => res.send({ success: false, msg: err }));
});

const validateRegister = (data) => {
  const schema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    username: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    organization: Joi.string().empty("").default("").optional(),
  });

  const { error } = schema.validate(data);
  return error;
};

module.exports = router;