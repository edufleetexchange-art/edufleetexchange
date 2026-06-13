import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import vehicleRoutes from '../../routes/vehicles.js';
import Vehicle from '../../models/Vehicle.js';
import Account from '../../models/Account.js';
import { JWT_CONFIG } from '../../config/jwt.js';

function signCookie(accountId: string, role: string): string {
  return `token=${jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: '1h' })}`;
}

let app: express.Express;
let vehicleId: string;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/vehicles', vehicleRoutes);

  const seller = await Account.create({
    name: 'Seller School', email: 'seller@e.com', password: 'pwpwpw', role: 'institute',
  });
  const v = await Vehicle.create({
    title: 'Bus', manufacturer: 'Tata', vehicleModel: 'Starbus', year: 2020,
    price: 100000, registrationNumber: 'KA01AB1234', mileage: 50000, condition: 'good',
    images: ['https://x/y.png'], description: 'A bus',
    sellerId: seller._id, sellerName: 'Seller School',
    sellerEmail: 'seller@e.com', sellerPhone: '+919876543210',
    status: 'approved',
  });
  vehicleId = String(v._id);
});

describe('GET /api/vehicles/:id PII masking', () => {
  it('hides seller email/phone from anonymous callers', async () => {
    const res = await request(app).get(`/api/vehicles/${vehicleId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sellerName).toBe('Seller School'); // business name still shown
    expect(res.body.data.sellerEmail).toBeUndefined();
    expect(res.body.data.sellerPhone).toBeUndefined();
  });

  it('reveals seller contact to authenticated callers', async () => {
    const buyer = await Account.create({ name: 'Buyer', email: 'buyer@e.com', password: 'pwpwpw', role: 'institute' });
    const res = await request(app)
      .get(`/api/vehicles/${vehicleId}`)
      .set('Cookie', signCookie(String(buyer._id), 'institute'));
    expect(res.status).toBe(200);
    expect(res.body.data.sellerEmail).toBe('seller@e.com');
    expect(res.body.data.sellerPhone).toBe('+919876543210');
  });

  it('hides seller email/phone in the public list too', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(200);
    const item = res.body.data.items.find((i: any) => String(i._id) === vehicleId);
    expect(item).toBeTruthy();
    expect(item.sellerEmail).toBeUndefined();
    expect(item.sellerPhone).toBeUndefined();
  });
});
