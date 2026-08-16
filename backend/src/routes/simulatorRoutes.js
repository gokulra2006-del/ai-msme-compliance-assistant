const express = require('express');
const router = express.Router();
const { runSimulation, getSimulationHistory, applySimulation, discardSimulation } = require('../controllers/simulationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/run', runSimulation);
router.get('/history', getSimulationHistory);
router.put('/:id/apply', applySimulation);
router.put('/:id/discard', discardSimulation);

module.exports = router;
