const db = require('../services/db.service');

exports.getRates = async (req, res) => {
  try {
    let rates = await db.printingRates.findUnique({
      where: { id: 'singleton' }
    });

    if (!rates) {
      // Initialize if not exists
      rates = await db.printingRates.create({
        data: { id: 'singleton', gstPercent: 18.0 }
      });
    }

    if (rates.gstPercent === undefined || rates.gstPercent === null) {
      rates.gstPercent = 18.0;
    }

    res.json({ success: true, data: rates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRates = async (req, res) => {
  try {
    // Only admins should be able to update rates (middleware handles this later)
    const rates = await db.printingRates.update({
      where: { id: 'singleton' },
      data: req.body
    });
    res.json({ success: true, data: rates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
