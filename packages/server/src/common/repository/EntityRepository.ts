import { cloneDeep, forOwn, isString } from 'lodash';
import { ModelEntityNotFound } from '../exceptions/ModelEntityNotFound';
import { Model } from 'objection';

/**
 * Custom error for column validation failures
 */
class InvalidColumnError extends Error {
  constructor(column: string, model: string, allowedColumns: string[]) {
    super(
      `Invalid column "${column}" for model ${model}. ` +
      `Allowed columns are: ${allowedColumns.join(', ')}`
    );
    this.name = 'InvalidColumnError';
  }
}

function applyGraphFetched(withRelations, builder) {
  const relations = Array.isArray(withRelations)
    ? withRelations
    : typeof withRelations === 'string'
      ? withRelations.split(',').map((relation) => relation.trim())
      : [];

  relations.forEach((relation) => {
    builder.withGraphFetched(relation);
  });
}

export class EntityRepository {
  idColumn: string = 'id';
  knex: any;

  // Cache for allowed columns to avoid repeated schema parsing
  private _allowedColumnsCache: Set<string> | null = null;

  /**
   * Retrieve the repository model binded it to knex instance.
   */
  get model(): typeof Model {
    throw new Error("The repository's model is not defined.");
  }

  /**
   * Get allowed columns for this model. Can be overridden in subclasses
   * for custom validation rules.
   */
  protected getAllowedColumns(): Set<string> {
    // Return cached value if available
    if (this._allowedColumnsCache) {
      return this._allowedColumnsCache;
    }

    const columns = new Set<string>();

    try {
      // 1. Try to get columns from Objection.js JSON schema
      const jsonSchema = this.model.jsonSchema;
      if (jsonSchema && jsonSchema.properties) {
        Object.keys(jsonSchema.properties).forEach(col => columns.add(col));
      }

      // 2. Add common columns that are typically safe
      const commonColumns = ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'];
      commonColumns.forEach(col => columns.add(col));

      // 3. Add the configured ID column
      if (this.idColumn) {
        columns.add(this.idColumn);
      }

      // 4. Allow subclasses to add additional columns
      const additionalColumns = this.getAdditionalAllowedColumns();
      additionalColumns.forEach(col => columns.add(col));
    } catch (error) {
      console.warn(`Error building column whitelist for model ${this.model.name}:`, error);
    }

    // Cache the result
    this._allowedColumnsCache = columns;

    return columns;
  }

  /**
   * Override in subclasses to add model-specific allowed columns
   */
  protected getAdditionalAllowedColumns(): string[] {
    return [];
  }

  /**
   * Regex to validate column name format (alphanumeric + underscore only)
   */
  private static VALID_COLUMN_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  /**
   * Maximum column name length to prevent buffer overflow attacks
   */
  private static MAX_COLUMN_LENGTH = 64;

  /**
   * SQL keyword blacklist to prevent common injection patterns
   */
  private static SQL_KEYWORDS = new Set([
    'select', 'insert', 'update', 'delete', 'drop', 'create',
    'alter', 'exec', 'execute', 'union', 'from', 'where',
    'grant', 'revoke', 'truncate', 'declare', 'cast'
  ]);

  /**
   * Extracts base column name from potentially prefixed column
   * e.g., "table.column" -> "column", "alias.column" -> "column"
   */
  protected extractBaseColumnName(column: string): string {
    // Handle dot notation for joins
    const parts = column.split('.');
    return parts[parts.length - 1];
  }

  /**
   * Validates a column name against security rules and allowed columns list
   */
  protected validateColumn(column: string): void {
    // Basic format validation
    if (!EntityRepository.VALID_COLUMN_PATTERN.test(column)) {
      throw new InvalidColumnError(
        column,
        this.model.name,
        ['Column names must contain only letters, numbers, and underscores']
      );
    }

    // Length validation
    if (column.length > EntityRepository.MAX_COLUMN_LENGTH) {
      throw new InvalidColumnError(
        column,
        this.model.name,
        ['Column name too long (max 64 characters)']
      );
    }

    // Extract base column name for SQL keyword check
    const baseColumn = this.extractBaseColumnName(column);

    // SQL keyword validation
    if (EntityRepository.SQL_KEYWORDS.has(baseColumn.toLowerCase())) {
      throw new InvalidColumnError(
        column,
        this.model.name,
        ['Column name contains SQL keyword']
      );
    }

    // Whitelist validation
    const allowedColumns = this.getAllowedColumns();

    // If we have no allowed columns defined, log a warning but allow
    // This maintains backward compatibility but should be addressed
    if (allowedColumns.size === 0) {
      console.warn(
        `No allowed columns defined for model ${this.model.name}. ` +
        `Consider implementing getAdditionalAllowedColumns() or adding a JSON schema.`
      );
      return;
    }

    if (!allowedColumns.has(baseColumn)) {
      throw new InvalidColumnError(
        column,
        this.model.name,
        Array.from(allowedColumns).sort()
      );
    }
  }

  /**
   * Validates multiple column names
   */
  protected validateColumns(columns: string[]): void {
    columns.forEach(column => this.validateColumn(column));
  }

  /**
   * Retrieve all entries with specified relations.
   * @param withRelations
   */
  all(withRelations?, trx?) {
    const builder = this.model.query(trx);
    applyGraphFetched(withRelations, builder);

    return builder;
  }

  /**
   * Finds list of entities with specified attributes
   *
   * @param {Object} attributeValues - values to filter retrieved entities by
   * @param {string || string[]} [withRelations] - name of relation(s) to eagerly retrieve.
   * @returns {Promise<Object[]>} - query builder. You can chain additional methods to it or call "await" or then() on it to execute
   */
  find(attributeValues = {}, withRelations?) {
    // Validate column names to prevent SQL injection
    if (attributeValues && typeof attributeValues === 'object') {
      const columnNames = Object.keys(attributeValues);
      this.validateColumns(columnNames);
    }

    const builder = this.model.query().where(attributeValues);

    applyGraphFetched(withRelations, builder);
    return builder;
  }

  /**
   * Finds list of entities with attribute values that are different from specified ones
   *
   * @param {Object} attributeValues - values to filter retrieved entities by
   * @param {string || string[]} [withRelations] - name of relation(s) to eagerly retrieve, as defined in model relationMappings()
   * @returns {PromiseLike<Object[]>} - query builder. You can chain additional methods to it or call "await" or then() on it to execute
   */
  findWhereNot(attributeValues = {}, withRelations?) {
    // Validate column names to prevent SQL injection
    if (attributeValues && typeof attributeValues === 'object') {
      const columnNames = Object.keys(attributeValues);
      this.validateColumns(columnNames);
    }

    const builder = this.model.query().whereNot(attributeValues);

    applyGraphFetched(withRelations, builder);
    return builder;
  }

  /**
   * Finds list of entities with specified attributes (any of multiple specified values)
   * Supports both ('attrName', ['value1', 'value2]) and ({attrName: ['value1', 'value2']} formats)
   *
   * @param {string|Object} searchParam - attribute name or search criteria object
   * @param {*[]} [attributeValues] - attribute values to filter retrieved entities by
   * @param {string || string[]} [withRelations] - name of relation(s) to eagerly retrieve, as defined in model relationMappings()
   * @returns {PromiseLike<Object[]>} - query builder. You can chain additional methods to it or call "await" or then() on it to execute
   */
  findWhereIn(searchParam, attributeValues, withRelations?) {
    const commonBuilder = (builder) => {
      applyGraphFetched(withRelations, builder);
    };

    try {
      if (isString(searchParam)) {
        // Validate single column name to prevent SQL injection
        this.validateColumn(searchParam);

        return this.model
          .query()
          .whereIn(searchParam, attributeValues)
          .onBuild(commonBuilder);
      } else {
        // Validate all column names in the object to prevent SQL injection
        const columnNames = Object.keys(searchParam);
        this.validateColumns(columnNames);

        const builder = this.model.query(this.knex).onBuild(commonBuilder);

        forOwn(searchParam, (value, key) => {
          // Key was already validated above
          if (Array.isArray(value)) {
            builder.whereIn(key, value);
          } else {
            builder.where(key, value);
          }
        });
        return builder;
      }
    } catch (error) {
      // Log security errors for monitoring
      if (error instanceof InvalidColumnError) {
        console.error(`Security: Column validation failed in findWhereIn - ${error.message}`);

        // In production, you might want to return a generic error
        // to avoid exposing schema information to potential attackers
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Invalid query parameters');
        }
      }
      throw error;
    }
  }

  /**
   * Finds first entity by given parameters
   *
   * @param {Object} attributeValues - values to filter retrieved entities by
   * @param {string || string[]} [withRelations] - name of relation(s) to eagerly retrieve, as defined in model relationMappings()
   * @returns {Promise<Object>}
   */
  async findOne(attributeValues = {}, withRelations?) {
    const results = await this.find(attributeValues, withRelations);
    return results[0] || null;
  }

  /**
   * Finds first entity by given parameters
   *
   * @param {string || number} id - value of id column of the entity
   * @param {string || string[]} [withRelations] - name of relation(s) to eagerly retrieve, as defined in model relationMappings()
   * @returns {Promise<Object>}
   */
  findOneById(id, withRelations?) {
    return this.findOne({ [this.idColumn]: id }, withRelations);
  }

  /**
   * Persists new entity or an array of entities.
   * This method does not recursively persist related entities, use createRecursively (to be implemented) for that.
   * Batch insert only works on PostgreSQL
   *
   * @param {Object} entity - model instance or parameters for a new entity
   * @returns {Promise<Object>} - query builder. You can chain additional methods to it or call "await" or then() on it to execute
   */
  create(entity, trx?) {
    // Keep the input parameter immutable
    const instanceDTO = cloneDeep(entity);

    return this.model.query(trx).insert(instanceDTO);
  }

  /**
   * Persists updated entity. If previously set fields are not present, performs an incremental update (does not remove fields unless explicitly set to null)
   *
   * @param   {Object} entity - single entity instance
   * @returns {Promise<integer>} number of affected rows
   */
  async update(entity, whereAttributes?, trx?) {
    const entityDto = cloneDeep(entity);
    const identityClause = {};

    if (Array.isArray(this.idColumn)) {
      this.idColumn.forEach(
        (idColumn) => (identityClause[idColumn] = entityDto[idColumn]),
      );
    } else {
      identityClause[this.idColumn] = entityDto[this.idColumn];
    }
    const whereConditions = whereAttributes || identityClause;
    const modifiedEntitiesCount = await this.model
      .query(trx)
      .where(whereConditions)
      .update(entityDto);

    if (modifiedEntitiesCount === 0) {
      throw new ModelEntityNotFound(entityDto[this.idColumn]);
    }
    return modifiedEntitiesCount;
  }

  /**
   *
   * @param {Object} attributeValues - values to filter deleted entities by
   * @param {Object} [trx]
   * @returns {Promise<integer>} Query builder. After promise is resolved, returns count of deleted rows
   */
  deleteBy(attributeValues, trx?) {
    // Validate column names to prevent SQL injection
    if (attributeValues && typeof attributeValues === 'object') {
      const columnNames = Object.keys(attributeValues);
      this.validateColumns(columnNames);
    }

    return this.model.query(trx).delete().where(attributeValues);
  }

  /**
   * @param {string || number} id - value of id column of the entity
   * @returns {Promise<integer>} Query builder. After promise is resolved, returns count of deleted rows
   */
  deleteById(id: number | string, trx?) {
    return this.deleteBy(
      {
        [this.idColumn]: id,
      },
      trx,
    );
  }

  /**
   * Deletes the given entries in the array on the specific field.
   * @param {string} field -
   * @param {number|string} values -
   */
  deleteWhereIn(field: string, values: (string | number)[], trx) {
    // Validate column name to prevent SQL injection
    this.validateColumn(field);
    return this.model.query(trx).whereIn(field, values).delete();
  }

  /**
   *
   * @param {string|number[]} values
   */
  deleteWhereIdIn(values: (string | number)[], trx?) {
    return this.deleteWhereIn(this.idColumn, values, trx);
  }

  /**
   * Arbitrary relation graphs can be upserted (insert + update + delete)
   * using the upsertGraph method.
   * @param graph
   * @param options
   */
  upsertGraph(graph, options) {
    // Keep the input grpah immutable
    const graphCloned = cloneDeep(graph);
    return this.model.query().upsertGraph(graphCloned, options);
  }

  /**
   *
   * @param {object} whereAttributes
   * @param {string} field
   * @param amount
   */
  changeNumber(whereAttributes, field: string, amount: number, trx) {
    // Validate the field being incremented/decremented to prevent SQL injection
    this.validateColumn(field);

    // Also validate where condition columns
    if (whereAttributes && typeof whereAttributes === 'object') {
      const whereColumns = Object.keys(whereAttributes);
      this.validateColumns(whereColumns);
    }

    const changeMethod = amount > 0 ? 'increment' : 'decrement';

    return this.model
      .query(trx)
      .where(whereAttributes)
      [changeMethod](field, Math.abs(amount));
  }
}
