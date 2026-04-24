import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../app/app.module';
import { User, UserRole } from '../users/entities/user.entity';
import { BalanceTransaction, TransactionSource } from '../wallet/entities/balance-transaction.entity';
import { createTestDataSourceWithEntities } from '../../test/test-db-setup';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Wallet Rollback Service (e2e)', () => {
  let app: INestApplication;
  let balanceTransactionRepository: Repository<BalanceTransaction>;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let configService: ConfigService;
  let testDataSource;

  let adminToken: string;
  let testUser: User;
  let testAdmin: User;

  beforeAll(async () => {
    testDataSource = await createTestDataSourceWithEntities([
      BalanceTransaction,
      User,
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATA_SOURCE')
      .useValue(testDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    balanceTransactionRepository = moduleFixture.get<Repository<BalanceTransaction>>(
      getRepositoryToken(BalanceTransaction),
    );
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    await app.init();

    // Create test users
    testUser = await userRepository.save({
      email: 'test@example.com',
      username: 'testuser',
      role: UserRole.USER,
    });

    testAdmin = await userRepository.save({
      email: 'admin@example.com',
      username: 'admin',
      role: UserRole.ADMIN,
    });

    // Generate tokens
    adminToken = jwtService.sign({
      sub: testAdmin.id,
      email: testAdmin.email,
      role: testAdmin.role,
    });
  });

  afterAll(async () => {
    await testDataSource.destroy();
    await app.close();
  });

  describe('Admin Balance Adjustments', () => {
    it('should allow admin to credit user balance', () => {
      return request(app.getHttpServer())
        .post('/wallet/admin/balance-adjustment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserId: testUser.id,
          amount: 1000,
          adjustmentType: 'credit',
          reason: 'Test credit adjustment',
          referenceId: 'test-credit-001',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.transactionId).toBeDefined();
        });
    });

    it('should allow admin to debit user balance', async () => {
      // First credit some balance
      await request(app.getHttpServer())
        .post('/wallet/admin/balance-adjustment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserId: testUser.id,
          amount: 500,
          adjustmentType: 'credit',
          reason: 'Setup for debit test',
        });

      // Then debit
      return request(app.getHttpServer())
        .post('/wallet/admin/balance-adjustment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserId: testUser.id,
          amount: 200,
          adjustmentType: 'debit',
          reason: 'Test debit adjustment',
          referenceId: 'test-debit-001',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.transactionId).toBeDefined();
        });
    });

    it('should reject debit when insufficient balance', () => {
      return request(app.getHttpServer())
        .post('/wallet/admin/balance-adjustment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserId: testUser.id,
          amount: 10000, // More than available
          adjustmentType: 'debit',
          reason: 'Test insufficient balance',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Insufficient balance');
        });
    });
  });

  describe('Transaction History', () => {
    it('should return user transaction history', async () => {
      // Create some transactions first
      await request(app.getHttpServer())
        .post('/wallet/admin/balance-adjustment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserId: testUser.id,
          amount: 100,
          adjustmentType: 'credit',
          reason: 'Transaction history test',
        });

      return request(app.getHttpServer())
        .get(`/wallet/admin/transactions/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('userId', testUser.id);
          expect(res.body[0]).toHaveProperty('metadata');
        });
    });

    it('should return user balance', () => {
      return request(app.getHttpServer())
        .get(`/wallet/admin/balance/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('available');
          expect(res.body).toHaveProperty('locked');
          expect(typeof res.body.available).toBe('number');
          expect(typeof res.body.locked).toBe('number');
        });
    });
  });

  describe('Transaction Rollback', () => {
    let transactionIdToRollback: string;

    it('should create a transaction to rollback', async () => {
      const response = await request(app.getHttpServer())
        .post('/wallet/admin/balance-adjustment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserId: testUser.id,
          amount: 50,
          adjustmentType: 'credit',
          reason: 'Transaction to rollback',
        });

      transactionIdToRollback = response.body.transactionId;
      expect(transactionIdToRollback).toBeDefined();
    });

    it('should rollback a transaction', () => {
      return request(app.getHttpServer())
        .post('/wallet/admin/rollback')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transactionIds: [transactionIdToRollback],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.compensatingTransactionIds).toHaveLength(1);
        });
    });
  });
});