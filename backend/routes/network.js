const express = require('express');
const router = express.Router();

const components = [
  { id: "ue", name: "User Equipment (UE)", type: "endpoint" },
  { id: "gnb", name: "gNodeB (gNB)", type: "radio" },
  { id: "amf", name: "AMF", type: "core" },
  { id: "smf", name: "SMF", type: "core" },
  { id: "upf", name: "UPF", type: "core" },
  { id: "ml", name: "ML Engine", type: "security" }
];

const connections = [
  { from: "ue", to: "gnb" },
  { from: "gnb", to: "amf" },
  { from: "amf", to: "smf" },
  { from: "smf", to: "upf" },
  { from: "upf", to: "ml" }
];

router.get('/', (req, res, next) => {
  try {
    const activeComponents = components.map(c => {
      const rand = Math.random();
      let status = "active";
      if (rand < 0.01) status = "error";
      else if (rand < 0.06) status = "warning";

      return {
        ...c,
        status
      };
    });

    res.json({
      success: true,
      components: activeComponents,
      connections
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
