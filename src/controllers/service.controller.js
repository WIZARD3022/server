const db = require('../services/db.service');

const DEFAULT_SERVICES = [
  {
    title: 'Custom Software & Web Development',
    category: 'DEVELOPMENT',
    shortDescription: 'Full-stack web apps, mobile apps, Python scripts & campus project development.',
    description: 'Our expert student engineering team builds custom websites, Flutter mobile apps, Python/AI scripts, and backend REST APIs for your academic projects or startups with clean documentation.',
    price: 499,
    priceUnit: 'project',
    images: ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600'],
    isAvailable: true,
    isFeatured: true,
    rating: 4.9,
    totalReviews: 24,
    tags: ['web', 'app', 'python', 'flutter', 'react', 'node']
  },
  {
    title: 'Scientific Calculator Rental (Casio FX-991EX)',
    category: 'TOOL_RENTAL',
    shortDescription: 'Casio fx-991EX ClassWiz non-programmable scientific calculator on daily rental.',
    description: 'High-precision Casio ClassWiz Scientific Calculator for engineering & science exams, lab practicals, and vivas. Clean, tested, and fully functional.',
    price: 30,
    priceUnit: 'day',
    images: ['https://images.unsplash.com/photo-1611125832047-1d7ad1e8e48a?w=600'],
    isAvailable: true,
    isFeatured: true,
    rating: 4.8,
    totalReviews: 42,
    tags: ['calculator', 'casio', 'rent', 'exams', 'lab']
  },
  {
    title: 'Arduino & Raspberry Pi Electronics Lab Kit',
    category: 'TOOL_RENTAL',
    shortDescription: 'Complete IoT & robotics sensor kit with breadboards, motors & jumper wires.',
    description: 'Includes Arduino Uno / Raspberry Pi 4, Ultrasonic Sensors, LCD displays, Servo Motors, Relay modules, and jumper wire bundles for semester lab projects.',
    price: 99,
    priceUnit: 'day',
    images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=600'],
    isAvailable: true,
    isFeatured: true,
    rating: 4.9,
    totalReviews: 18,
    tags: ['arduino', 'raspberrypi', 'iot', 'robotics', 'kit']
  },
  {
    title: 'High-Performance Laptop on Rent',
    category: 'TOOL_RENTAL',
    shortDescription: 'Core i7 / 16GB RAM laptop for presentation, CAD modeling & coding exams.',
    description: 'Pre-loaded with VS Code, MATLAB, AutoCAD, Python, and Microsoft Office for urgent presentations, lab exams, and coding hackathons.',
    price: 249,
    priceUnit: 'day',
    images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600'],
    isAvailable: true,
    isFeatured: false,
    rating: 4.7,
    totalReviews: 15,
    tags: ['laptop', 'rent', 'coding', 'autocad']
  }
];

// Seed default services if empty
const seedServicesIfEmpty = async () => {
  const count = await db.service.count();
  if (count === 0) {
    for (const s of DEFAULT_SERVICES) {
      await db.service.create({ data: s });
    }
  }
};

exports.getServices = async (req, res) => {
  try {
    await seedServicesIfEmpty();
    const { category, search, featured } = req.query;
    let where = { isAvailable: true };

    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    if (search && search.trim()) {
      where.title = { contains: search.trim(), mode: 'insensitive' };
    }

    const services = await db.service.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const service = await db.service.findUnique({ where: { id: req.params.id } });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const { serviceId, requirements, rentalDays, contactPhone, preferredDate } = req.body;
    const userId = req.user.id;

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    const days = Math.max(1, parseInt(rentalDays || 1));
    const totalAmount = (service.price || 0) * (service.priceUnit === 'day' ? days : 1);

    const booking = await db.serviceBooking.create({
      data: {
        serviceId: service.id,
        serviceTitle: service.title,
        userId,
        category: service.category,
        requirements: (requirements || '').trim(),
        rentalDays: days,
        totalAmount,
        contactPhone: (contactPhone || '').trim(),
        preferredDate: preferredDate ? new Date(preferredDate) : new Date(),
        status: 'PENDING'
      }
    });

    // Notify user
    await db.notification.create({
      data: {
        userId,
        title: 'Service Booking Requested!',
        message: `Your booking for "${service.title}" has been placed. Our team will contact you shortly.`,
        icon: 'support'
      }
    });

    res.status(201).json({ success: true, message: 'Booking requested successfully!', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await db.serviceBooking.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Controllers

exports.getAllServices = async (req, res) => {
  try {
    await seedServicesIfEmpty();
    const services = await db.service.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createService = async (req, res) => {
  try {
    const { title, category, shortDescription, description, price, priceUnit, images, isAvailable, isFeatured, tags } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Service title is required' });
    }

    const service = await db.service.create({
      data: {
        title: title.trim(),
        category: category || 'DEVELOPMENT',
        shortDescription: (shortDescription || '').trim(),
        description: (description || '').trim(),
        price: Math.max(0, Number(price || 0)),
        priceUnit: priceUnit || 'project',
        images: Array.isArray(images) ? images : [],
        isAvailable: isAvailable !== false,
        isFeatured: Boolean(isFeatured),
        tags: Array.isArray(tags) ? tags : []
      }
    });

    res.status(201).json({ success: true, message: 'Service created successfully', data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, shortDescription, description, price, priceUnit, images, isAvailable, isFeatured, tags } = req.body;

    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Service not found' });

    const updated = await db.service.update({
      where: { id },
      data: {
        title: title ? title.trim() : existing.title,
        category: category || existing.category,
        shortDescription: shortDescription !== undefined ? shortDescription.trim() : existing.shortDescription,
        description: description !== undefined ? description.trim() : existing.description,
        price: price !== undefined ? Math.max(0, Number(price)) : existing.price,
        priceUnit: priceUnit || existing.priceUnit,
        images: Array.isArray(images) ? images : existing.images,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : existing.isAvailable,
        isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : existing.isFeatured,
        tags: Array.isArray(tags) ? tags : existing.tags
      }
    });

    res.json({ success: true, message: 'Service updated successfully', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.service.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Service not found' });

    await db.service.delete({ where: { id } });
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await db.serviceBooking.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await db.serviceBooking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const updated = await db.serviceBooking.update({
      where: { id },
      data: { status }
    });

    // Notify user
    await db.notification.create({
      data: {
        userId: booking.userId,
        title: `Service Booking ${status}`,
        message: `Your booking for "${booking.serviceTitle}" status is now ${status}.`,
        icon: 'support'
      }
    });

    res.json({ success: true, message: `Booking status updated to ${status}`, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
