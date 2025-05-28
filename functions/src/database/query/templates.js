/**
 * Query Templates for Common Operations
 * Pre-defined query patterns for frequently used database operations
 */

const QueryBuilder = require('../queryBuilder');

/**
 * Common query templates
 */
class QueryTemplates {
  /**
   * Find record by ID
   */
  static findById(table, id, fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .where('id', id);
  }

  /**
   * Find records by multiple IDs
   */
  static findByIds(table, ids, fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .whereIn('id', ids);
  }

  /**
   * Find record by field
   */
  static findBy(table, field, value, fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .where(field, value);
  }

  /**
   * Paginated list with optional search
   */
  static paginate(table, page = 1, limit = 10, searchField = null, searchValue = null, fields = ['*']) {
    const offset = (page - 1) * limit;
    const query = QueryBuilder.table(table)
      .select(fields)
      .limit(limit)
      .offset(offset);

    if (searchField && searchValue) {
      query.whereLike(searchField, `%${searchValue}%`);
    }

    return query;
  }

  /**
   * Count records with optional filter
   */
  static countRecords(table, field = null, value = null) {
    const query = QueryBuilder.table(table);
    
    if (field && value) {
      query.where(field, value);
    }
    
    return query.count();
  }

  /**
   * Soft delete (update deleted_at field)
   */
  static softDelete(table, id, deletedAt = new Date()) {
    return QueryBuilder.table(table)
      .update({ deleted_at: deletedAt })
      .where('id', id);
  }

  /**
   * Bulk soft delete
   */
  static bulkSoftDelete(table, ids, deletedAt = new Date()) {
    return QueryBuilder.table(table)
      .update({ deleted_at: deletedAt })
      .whereIn('id', ids);
  }

  /**
   * Restore soft deleted record
   */
  static restore(table, id) {
    return QueryBuilder.table(table)
      .update({ deleted_at: null })
      .where('id', id);
  }

  /**
   * Find active records (not soft deleted)
   */
  static findActive(table, fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .whereNull('deleted_at');
  }

  /**
   * Update record by ID
   */
  static updateById(table, id, data) {
    // Add updated_at timestamp if not provided
    if (!data.updated_at) {
      data.updated_at = new Date();
    }
    
    return QueryBuilder.table(table)
      .update(data)
      .where('id', id);
  }

  /**
   * Bulk update records
   */
  static bulkUpdate(table, ids, data) {
    if (!data.updated_at) {
      data.updated_at = new Date();
    }
    
    return QueryBuilder.table(table)
      .update(data)
      .whereIn('id', ids);
  }

  /**
   * Insert with timestamps
   */
  static create(table, data) {
    const now = new Date();
    
    return QueryBuilder.table(table)
      .insert({
        ...data,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now
      });
  }

  /**
   * Bulk insert with timestamps
   */
  static bulkCreate(table, records) {
    const now = new Date();
    
    const recordsWithTimestamps = records.map(record => ({
      ...record,
      created_at: record.created_at || now,
      updated_at: record.updated_at || now
    }));
    
    return QueryBuilder.table(table)
      .insert(recordsWithTimestamps);
  }

  /**
   * Search records with full-text search
   */
  static fullTextSearch(table, searchFields, searchTerm, fields = ['*'], limit = 50) {
    const query = QueryBuilder.table(table)
      .select(fields)
      .limit(limit);

    // Add MATCH AGAINST for full-text search
    if (searchFields.length > 0 && searchTerm) {
      const matchFields = searchFields.join(', ');
      query.whereConditions.push({
        field: `MATCH(${matchFields})`,
        operator: 'AGAINST',
        value: searchTerm,
        logic: 'AND',
        paramIndex: query.addParameter(`"${searchTerm}"`)
      });
    }

    return query;
  }

  /**
   * Get recent records
   */
  static getRecent(table, dateField = 'created_at', days = 7, fields = ['*'], limit = 100) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return QueryBuilder.table(table)
      .select(fields)
      .where(dateField, '>=', startDate)
      .orderByDesc(dateField)
      .limit(limit);
  }

  /**
   * Get records by date range
   */
  static getByDateRange(table, dateField, startDate, endDate, fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .whereBetween(dateField, startDate, endDate)
      .orderBy(dateField);
  }

  /**
   * Aggregate query with grouping
   */
  static aggregateBy(table, groupField, aggregateField, aggregateFunction = 'COUNT', having = null) {
    const query = QueryBuilder.table(table)
      .select([groupField, `${aggregateFunction}(${aggregateField}) as aggregate_value`])
      .groupBy(groupField)
      .orderByDesc('aggregate_value');

    if (having) {
      query.having('aggregate_value', having.operator || '>', having.value || 0);
    }

    return query;
  }

  /**
   * Join with related table
   */
  static withRelated(table, relatedTable, foreignKey, relatedKey = 'id', fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .join(relatedTable, `${table}.${foreignKey}`, `${relatedTable}.${relatedKey}`);
  }

  /**
   * Left join with related table (includes records without relations)
   */
  static withOptionalRelated(table, relatedTable, foreignKey, relatedKey = 'id', fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .leftJoin(relatedTable, `${table}.${foreignKey}`, `${relatedTable}.${relatedKey}`);
  }

  /**
   * Check if record exists
   */
  static exists(table, field, value) {
    return QueryBuilder.table(table)
      .select(['1'])
      .where(field, value)
      .limit(1);
  }

  /**
   * Get duplicate records
   */
  static findDuplicates(table, fields, havingCount = 1) {
    return QueryBuilder.table(table)
      .select([...fields, 'COUNT(*) as duplicate_count'])
      .groupBy(...fields)
      .having('duplicate_count', '>', havingCount);
  }

  /**
   * Upsert operation (INSERT ... ON DUPLICATE KEY UPDATE)
   */
  static upsert(table, data, updateFields = null) {
    const insertFields = Object.keys(data);
    const insertValues = Object.values(data);
    
    // If updateFields not specified, update all fields except primary key
    const fieldsToUpdate = updateFields || insertFields.filter(field => field !== 'id');
    
    const updateClause = fieldsToUpdate
      .map(field => `${field} = VALUES(${field})`)
      .join(', ');
    
    const placeholders = insertValues.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${insertFields.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;
    
    return QueryBuilder.raw(sql, insertValues);
  }

  /**
   * Random sample of records
   */
  static randomSample(table, limit = 10, fields = ['*']) {
    return QueryBuilder.table(table)
      .select(fields)
      .orderBy('RAND()')
      .limit(limit);
  }

  /**
   * Get statistics for a numeric field
   */
  static getFieldStats(table, field, whereConditions = null) {
    const query = QueryBuilder.table(table)
      .select([
        `COUNT(${field}) as count`,
        `AVG(${field}) as average`,
        `MIN(${field}) as minimum`,
        `MAX(${field}) as maximum`,
        `SUM(${field}) as total`,
        `STDDEV(${field}) as standard_deviation`
      ]);

    if (whereConditions) {
      Object.entries(whereConditions).forEach(([key, value]) => {
        query.where(key, value);
      });
    }

    return query;
  }
}

module.exports = QueryTemplates;
