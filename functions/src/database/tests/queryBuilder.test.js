/**
 * Query Builder Framework Test Suite
 * Comprehensive tests for all query builder components
 */

const QueryBuilder = require('../queryBuilder');
const QueryTemplates = require('../query/templates');
const { TransactionManager } = require('../query/transactionManager');
const { SqlUtils, QueryValidator, QueryOptimizer } = require('../query/utils');
const { Database, Model } = require('../index');

describe('Query Builder Framework', () => {
  
  describe('QueryBuilder Core Functionality', () => {
    
    describe('SELECT Queries', () => {
      test('should build basic SELECT query', () => {
        const query = QueryBuilder.table('users').select(['id', 'name']);
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT id, name FROM users');
        expect(params).toEqual([]);
      });

      test('should build SELECT with WHERE clause', () => {
        const query = QueryBuilder.table('users')
          .select(['id', 'name'])
          .where('active', true)
          .where('age', '>', 18);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT id, name FROM users WHERE active = ? AND age > ?');
        expect(params).toEqual([true, 18]);
      });

      test('should build SELECT with JOINs', () => {
        const query = QueryBuilder.table('users')
          .select(['users.id', 'users.name', 'profiles.bio'])
          .join('profiles', 'users.id', 'profiles.user_id')
          .where('users.active', true);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT users.id, users.name, profiles.bio FROM users INNER JOIN profiles ON users.id = profiles.user_id WHERE users.active = ?');
        expect(params).toEqual([true]);
      });

      test('should build SELECT with ORDER BY and LIMIT', () => {
        const query = QueryBuilder.table('users')
          .select(['id', 'name'])
          .orderBy('created_at', 'DESC')
          .limit(10)
          .offset(20);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT id, name FROM users ORDER BY created_at DESC LIMIT 10 OFFSET 20');
        expect(params).toEqual([]);
      });

      test('should build SELECT with GROUP BY and HAVING', () => {
        const query = QueryBuilder.table('orders')
          .select(['customer_id', 'COUNT(*) as order_count'])
          .groupBy('customer_id')
          .having('order_count', '>', 5);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT customer_id, COUNT(*) as order_count FROM orders GROUP BY customer_id HAVING order_count > ?');
        expect(params).toEqual([5]);
      });
    });

    describe('INSERT Queries', () => {
      test('should build INSERT query', () => {
        const data = { name: 'John Doe', email: 'john@example.com', age: 30 };
        const query = QueryBuilder.table('users').insert(data);
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
        expect(params).toEqual(['John Doe', 'john@example.com', 30]);
      });

      test('should build batch INSERT query', () => {
        const data = [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' }
        ];
        const query = QueryBuilder.table('users').insert(data);
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('INSERT INTO users (name, email) VALUES (?, ?), (?, ?)');
        expect(params).toEqual(['John', 'john@example.com', 'Jane', 'jane@example.com']);
      });
    });

    describe('UPDATE Queries', () => {
      test('should build UPDATE query', () => {
        const data = { name: 'Jane Doe', updated_at: new Date('2023-01-01') };
        const query = QueryBuilder.table('users')
          .update(data)
          .where('id', 1);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('UPDATE users SET name = ?, updated_at = ? WHERE id = ?');
        expect(params).toEqual(['Jane Doe', new Date('2023-01-01'), 1]);
      });

      test('should build UPDATE with multiple WHERE conditions', () => {
        const query = QueryBuilder.table('users')
          .update({ status: 'inactive' })
          .where('last_login', '<', new Date('2023-01-01'))
          .where('status', 'active');
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('UPDATE users SET status = ? WHERE last_login < ? AND status = ?');
        expect(params).toEqual(['inactive', new Date('2023-01-01'), 'active']);
      });
    });

    describe('DELETE Queries', () => {
      test('should build DELETE query', () => {
        const query = QueryBuilder.table('users')
          .delete()
          .where('id', 1);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('DELETE FROM users WHERE id = ?');
        expect(params).toEqual([1]);
      });

      test('should build DELETE with multiple conditions', () => {
        const query = QueryBuilder.table('users')
          .delete()
          .where('active', false)
          .where('last_login', '<', new Date('2022-01-01'));
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('DELETE FROM users WHERE active = ? AND last_login < ?');
        expect(params).toEqual([false, new Date('2022-01-01')]);
      });
    });

    describe('Complex WHERE Conditions', () => {
      test('should handle IN clause', () => {
        const query = QueryBuilder.table('users')
          .select(['*'])
          .whereIn('id', [1, 2, 3, 4]);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT * FROM users WHERE id IN (?, ?, ?, ?)');
        expect(params).toEqual([1, 2, 3, 4]);
      });

      test('should handle BETWEEN clause', () => {
        const query = QueryBuilder.table('products')
          .select(['*'])
          .whereBetween('price', 10, 100);
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT * FROM products WHERE price BETWEEN ? AND ?');
        expect(params).toEqual([10, 100]);
      });

      test('should handle NULL checks', () => {
        const query = QueryBuilder.table('users')
          .select(['*'])
          .whereNull('deleted_at')
          .whereNotNull('email');
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT * FROM users WHERE deleted_at IS NULL AND email IS NOT NULL');
        expect(params).toEqual([]);
      });

      test('should handle LIKE queries', () => {
        const query = QueryBuilder.table('users')
          .select(['*'])
          .whereLike('name', '%john%');
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT * FROM users WHERE name LIKE ?');
        expect(params).toEqual(['%john%']);
      });

      test('should handle OR conditions', () => {
        const query = QueryBuilder.table('users')
          .select(['*'])
          .where('status', 'active')
          .orWhere('priority', 'high')
          .orWhere('role', 'admin');
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT * FROM users WHERE status = ? OR priority = ? OR role = ?');
        expect(params).toEqual(['active', 'high', 'admin']);
      });
    });

    describe('Raw Queries', () => {
      test('should handle raw SQL queries', () => {
        const query = QueryBuilder.raw(
          'SELECT * FROM users WHERE created_at > ? AND status = ?',
          [new Date('2023-01-01'), 'active']
        );
        
        const { sql, params } = query.toSQL();
        
        expect(sql).toBe('SELECT * FROM users WHERE created_at > ? AND status = ?');
        expect(params).toEqual([new Date('2023-01-01'), 'active']);
      });
    });
  });

  describe('Query Templates', () => {
    
    test('should generate findById query', () => {
      const query = QueryTemplates.findById('users', 1, ['id', 'name']);
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('SELECT id, name FROM users WHERE id = ?');
      expect(params).toEqual([1]);
    });

    test('should generate pagination query', () => {
      const query = QueryTemplates.paginate('users', 2, 10, 'name', 'john');
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('SELECT * FROM users WHERE name LIKE ? LIMIT 10 OFFSET 10');
      expect(params).toEqual(['%john%']);
    });

    test('should generate soft delete query', () => {
      const deletedAt = new Date('2023-01-01');
      const query = QueryTemplates.softDelete('users', 1, deletedAt);
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('UPDATE users SET deleted_at = ? WHERE id = ?');
      expect(params).toEqual([deletedAt, 1]);
    });

    test('should generate create query with timestamps', () => {
      const data = { name: 'John', email: 'john@example.com' };
      const query = QueryTemplates.create('users', data);
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('INSERT INTO users (name, email, created_at, updated_at) VALUES (?, ?, ?, ?)');
      expect(params[0]).toBe('John');
      expect(params[1]).toBe('john@example.com');
      expect(params[2]).toBeInstanceOf(Date);
      expect(params[3]).toBeInstanceOf(Date);
    });

    test('should generate bulk create query', () => {
      const records = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ];
      const query = QueryTemplates.bulkCreate('users', records);
      const { sql, params } = query.toSQL();
      
      expect(sql).toContain('INSERT INTO users (name, email, created_at, updated_at) VALUES');
      expect(sql).toContain('(?, ?, ?, ?), (?, ?, ?, ?)');
      expect(params).toHaveLength(8); // 4 params per record × 2 records
    });
  });

  describe('SQL Utilities', () => {
    
    describe('Identifier Validation', () => {
      test('should validate valid identifiers', () => {
        expect(SqlUtils.isValidIdentifier('users')).toBe(true);
        expect(SqlUtils.isValidIdentifier('user_table')).toBe(true);
        expect(SqlUtils.isValidIdentifier('_private')).toBe(true);
        expect(SqlUtils.isValidIdentifier('table123')).toBe(true);
      });

      test('should reject invalid identifiers', () => {
        expect(SqlUtils.isValidIdentifier('123table')).toBe(false);
        expect(SqlUtils.isValidIdentifier('user-table')).toBe(false);
        expect(SqlUtils.isValidIdentifier('user table')).toBe(false);
        expect(SqlUtils.isValidIdentifier('')).toBe(false);
        expect(SqlUtils.isValidIdentifier(null)).toBe(false);
      });

      test('should escape identifiers', () => {
        expect(SqlUtils.escapeIdentifier('users')).toBe('`users`');
        expect(SqlUtils.escapeIdentifier('user`table')).toBe('`user``table`');
      });
    });

    describe('Operator Validation', () => {
      test('should validate SQL operators', () => {
        expect(() => SqlUtils.validateOperator('=')).not.toThrow();
        expect(() => SqlUtils.validateOperator('LIKE')).not.toThrow();
        expect(() => SqlUtils.validateOperator('IN')).not.toThrow();
        expect(() => SqlUtils.validateOperator('BETWEEN')).not.toThrow();
      });

      test('should reject invalid operators', () => {
        expect(() => SqlUtils.validateOperator('INVALID')).toThrow();
        expect(() => SqlUtils.validateOperator('DROP')).toThrow();
      });
    });

    describe('Query Formatting', () => {
      test('should format SQL for logging', () => {
        const sql = 'SELECT * FROM users WHERE id = ? AND name = ?';
        const params = [1, 'John'];
        const formatted = SqlUtils.formatSqlForLogging(sql, params);
        
        expect(formatted).toBe("SELECT * FROM users WHERE id = 1 AND name = 'John'");
      });

      test('should handle NULL values in formatting', () => {
        const sql = 'SELECT * FROM users WHERE deleted_at = ?';
        const params = [null];
        const formatted = SqlUtils.formatSqlForLogging(sql, params);
        
        expect(formatted).toBe('SELECT * FROM users WHERE deleted_at = NULL');
      });
    });

    describe('Complexity Estimation', () => {
      test('should estimate query complexity', () => {
        const simpleQuery = 'SELECT * FROM users WHERE id = 1';
        expect(SqlUtils.estimateComplexity(simpleQuery)).toBe(1);

        const complexQuery = `
          SELECT u.*, p.bio, COUNT(o.id) as order_count
          FROM users u
          LEFT JOIN profiles p ON u.id = p.user_id
          LEFT JOIN orders o ON u.id = o.customer_id
          WHERE u.created_at > '2023-01-01'
          GROUP BY u.id
          HAVING order_count > 5
          ORDER BY order_count DESC
        `;
        expect(SqlUtils.estimateComplexity(complexQuery)).toBeGreaterThan(5);
      });
    });
  });

  describe('Query Validation', () => {
    
    test('should validate WHERE conditions', () => {
      const validConditions = [
        { field: 'id', operator: '=', value: 1, logic: 'AND' },
        { field: 'name', operator: 'LIKE', value: '%john%', logic: 'OR' }
      ];
      
      expect(() => QueryValidator.validateWhereConditions(validConditions)).not.toThrow();
    });

    test('should reject invalid WHERE conditions', () => {
      const invalidConditions = [
        { field: '123invalid', operator: '=', value: 1, logic: 'AND' }
      ];
      
      expect(() => QueryValidator.validateWhereConditions(invalidConditions)).toThrow();
    });

    test('should validate SELECT fields', () => {
      const validFields = ['id', 'name', 'email', '*'];
      expect(() => QueryValidator.validateSelectFields(validFields)).not.toThrow();
    });

    test('should validate INSERT/UPDATE data', () => {
      const validData = { name: 'John', email: 'john@example.com', age: 30 };
      expect(() => QueryValidator.validateDataObject(validData)).not.toThrow();

      const validBatchData = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ];
      expect(() => QueryValidator.validateDataObject(validBatchData)).not.toThrow();
    });
  });

  describe('Query Optimization', () => {
    
    test('should suggest optimizations', () => {
      const query = QueryBuilder.table('users').select(['*']).orderBy('created_at');
      const suggestions = QueryOptimizer.suggestOptimizations(query);
      
      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'optimization',
            message: expect.stringContaining('LIMIT')
          }),
          expect.objectContaining({
            type: 'optimization',
            message: expect.stringContaining('SELECT *')
          })
        ])
      );
    });

    test('should suggest indexes', () => {
      const query = QueryBuilder.table('users')
        .select(['id', 'name'])
        .where('email', 'john@example.com')
        .where('active', true)
        .orderBy('created_at');
      
      const indexSuggestions = QueryOptimizer.suggestIndexes(query);
      
      expect(indexSuggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: 'users',
            column: 'email',
            type: 'single',
            reason: 'WHERE clause filtering'
          }),
          expect.objectContaining({
            table: 'users',
            columns: ['created_at'],
            type: 'composite',
            reason: 'ORDER BY optimization'
          })
        ])
      );
    });
  });

  describe('Model Class', () => {
    
    class User extends Model {
      constructor() {
        super('users', 'id');
      }
    }

    let userModel;

    beforeEach(() => {
      userModel = new User();
    });

    test('should create model instance', () => {
      expect(userModel.tableName).toBe('users');
      expect(userModel.primaryKey).toBe('id');
    });

    test('should generate correct queries', () => {
      const findQuery = userModel.query().where('email', 'test@example.com');
      const { sql, params } = findQuery.toSQL();
      
      expect(sql).toBe('SELECT * FROM users WHERE email = ?');
      expect(params).toEqual(['test@example.com']);
    });
  });

  describe('Error Handling', () => {
    
    test('should throw error for invalid table name', () => {
      expect(() => {
        QueryBuilder.table('123invalid').select(['*']).toSQL();
      }).toThrow();
    });

    test('should throw error for missing table name in INSERT', () => {
      expect(() => {
        new QueryBuilder().insert({ name: 'John' }).toSQL();
      }).toThrow('Table name is required');
    });

    test('should throw error for empty INSERT data', () => {
      expect(() => {
        QueryBuilder.table('users').insert([]).toSQL();
      }).toThrow('Insert data cannot be empty');
    });

    test('should throw error for invalid WHERE IN values', () => {
      expect(() => {
        QueryBuilder.table('users').whereIn('id', []).toSQL();
      }).toThrow('whereIn requires a non-empty array of values');
    });
  });

  describe('Query Building Edge Cases', () => {
    
    test('should handle object WHERE conditions', () => {
      const query = QueryBuilder.table('users')
        .select(['*'])
        .where({ id: 1, active: true, role: 'admin' });
      
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('SELECT * FROM users WHERE id = ? AND active = ? AND role = ?');
      expect(params).toEqual([1, true, 'admin']);
    });

    test('should handle chained WHERE conditions', () => {
      const query = QueryBuilder.table('users')
        .select(['*'])
        .where('active', true)
        .where('role', 'admin')
        .orWhere('priority', 'high');
      
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('SELECT * FROM users WHERE active = ? AND role = ? OR priority = ?');
      expect(params).toEqual([true, 'admin', 'high']);
    });

    test('should handle multiple ORDER BY fields', () => {
      const query = QueryBuilder.table('users')
        .select(['*'])
        .orderBy('priority', 'DESC')
        .orderBy('created_at', 'ASC');
      
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('SELECT * FROM users ORDER BY priority DESC, created_at ASC');
      expect(params).toEqual([]);
    });

    test('should handle multiple GROUP BY fields', () => {
      const query = QueryBuilder.table('orders')
        .select(['customer_id', 'status', 'COUNT(*) as count'])
        .groupBy('customer_id', 'status');
      
      const { sql, params } = query.toSQL();
      
      expect(sql).toBe('SELECT customer_id, status, COUNT(*) as count FROM orders GROUP BY customer_id, status');
      expect(params).toEqual([]);
    });

    test('should clone query builder correctly', () => {
      const originalQuery = QueryBuilder.table('users')
        .select(['id', 'name'])
        .where('active', true)
        .orderBy('created_at');
      
      const clonedQuery = originalQuery.clone()
        .where('role', 'admin')
        .limit(10);
      
      // Original query should remain unchanged
      const { sql: originalSql } = originalQuery.toSQL();
      expect(originalSql).toBe('SELECT id, name FROM users WHERE active = ? ORDER BY created_at ASC');
      
      // Cloned query should have additional conditions
      const { sql: clonedSql } = clonedQuery.toSQL();
      expect(clonedSql).toBe('SELECT id, name FROM users WHERE active = ? AND role = ? ORDER BY created_at ASC LIMIT 10');
    });
  });
});

// Export test helpers for integration tests
module.exports = {
  QueryBuilder,
  QueryTemplates,
  SqlUtils,
  QueryValidator,
  QueryOptimizer
};
