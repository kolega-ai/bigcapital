import { SecureObjectTransformer } from './secure-transform.util';

describe('SecureObjectTransformer', () => {
  describe('Prototype Pollution Prevention', () => {
    it('should filter out __proto__ key', () => {
      const maliciousPayload = {
        "__proto__": { "isAdmin": true },
        "valid_key": "value"
      };

      const result = SecureObjectTransformer.transform(maliciousPayload, {
        keyTransformer: (key) => key.replace(/_/g, '').toLowerCase()
      });

      expect(result).not.toHaveProperty('__proto__');
      expect(result).toHaveProperty('validkey', 'value');
      
      // Ensure the prototype wasn't polluted
      const testObj = {};
      expect((testObj as any).isAdmin).toBeUndefined();
    });

    it('should filter out constructor key', () => {
      const maliciousPayload = {
        "constructor": {
          "prototype": { "isAdmin": true }
        },
        "normal_field": "value"
      };

      const result = SecureObjectTransformer.transform(maliciousPayload);

      expect(result).not.toHaveProperty('constructor');
      expect(result).toHaveProperty('normal_field', 'value');
    });

    it('should filter out prototype key', () => {
      const maliciousPayload = {
        "prototype": { "polluted": true },
        "safe_field": "value"
      };

      const result = SecureObjectTransformer.transform(maliciousPayload);

      expect(result).not.toHaveProperty('prototype');
      expect(result).toHaveProperty('safe_field', 'value');
    });

    it('should handle case variations of dangerous keys', () => {
      const maliciousPayload = {
        "__PROTO__": { "isAdmin": true },
        "Constructor": { "prototype": { "isAdmin": true } },
        "PROTOTYPE": { "polluted": true },
        "safe_field": "value"
      };

      const result = SecureObjectTransformer.transform(maliciousPayload);

      expect(result).not.toHaveProperty('__PROTO__');
      expect(result).not.toHaveProperty('Constructor');
      expect(result).not.toHaveProperty('PROTOTYPE');
      expect(result).toHaveProperty('safe_field', 'value');
    });

    it('should handle encoded dangerous keys', () => {
      const maliciousPayload = {
        "%5f%5fproto%5f%5f": { "isAdmin": true },
        "&#x5f;&#x5f;proto&#x5f;&#x5f;": { "isAdmin": true },
        "safe_field": "value"
      };

      const result = SecureObjectTransformer.transform(maliciousPayload);

      expect(result).not.toHaveProperty('%5f%5fproto%5f%5f');
      expect(result).not.toHaveProperty('&#x5f;&#x5f;proto&#x5f;&#x5f;');
      expect(result).toHaveProperty('safe_field', 'value');
    });
  });

  describe('Depth Limiting', () => {
    it('should throw error on deeply nested objects', () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) return { value: 'end' };
        return { nested: createDeepObject(depth - 1) };
      };

      const deepObject = createDeepObject(12);

      expect(() => {
        SecureObjectTransformer.transform(deepObject, { maxDepth: 10 });
      }).toThrow('Maximum object depth (10) exceeded');
    });

    it('should handle objects within depth limit', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              value: 'safe'
            }
          }
        }
      };

      const result = SecureObjectTransformer.transform(deepObject, { maxDepth: 5 });

      expect(result.level1.level2.level3.value).toBe('safe');
    });

    it('should handle deeply nested arrays', () => {
      const nestedArrays = {
        data: [
          [
            [
              { deeply: { nested: { value: 'test' } } }
            ]
          ]
        ]
      };

      expect(() => {
        SecureObjectTransformer.transform(nestedArrays, { maxDepth: 3 });
      }).toThrow('Maximum object depth');
    });
  });

  describe('Key Count Limiting', () => {
    it('should throw error on too many keys', () => {
      const manyKeys: any = {};
      for (let i = 0; i < 1100; i++) {
        manyKeys[`key_${i}`] = i;
      }

      expect(() => {
        SecureObjectTransformer.transform(manyKeys, { maxKeys: 1000 });
      }).toThrow('Maximum key count (1000) exceeded');
    });

    it('should handle objects within key limit', () => {
      const normalObject: any = {};
      for (let i = 0; i < 50; i++) {
        normalObject[`key_${i}`] = i;
      }

      const result = SecureObjectTransformer.transform(normalObject, { maxKeys: 100 });

      expect(Object.keys(result)).toHaveLength(50);
    });

    it('should prevent key count inflation after transformation', () => {
      const obj = {
        "key1": "value1",
        "key2": "value2"
      };

      // Malicious transformer that tries to create many keys
      const maliciousTransformer = (key: string) => {
        // This would normally create multiple keys, but should be prevented
        return key;
      };

      const result = SecureObjectTransformer.transform(obj, {
        keyTransformer: maliciousTransformer,
        maxKeys: 5
      });

      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('Key Pattern Validation', () => {
    it('should filter keys that do not match allowed pattern', () => {
      const maliciousObject = {
        "valid_key": "value1",
        "script>alert(1)</script": "malicious",
        "normal-field": "value2",
        "key.with.dots": "value3",
        "key with spaces": "invalid",
        "key/with/slashes": "invalid"
      };

      const result = SecureObjectTransformer.transform(maliciousObject, {
        allowedKeyPattern: /^[\w\-\.]+$/
      });

      expect(result).toHaveProperty('valid_key', 'value1');
      expect(result).toHaveProperty('normal-field', 'value2');
      expect(result).toHaveProperty('key.with.dots', 'value3');
      expect(result).not.toHaveProperty('script>alert(1)</script');
      expect(result).not.toHaveProperty('key with spaces');
      expect(result).not.toHaveProperty('key/with/slashes');
    });

    it('should use default pattern when none provided', () => {
      const testObject = {
        "valid_key": "value1",
        "invalid<key>": "value2",
        "another.valid.key": "value3"
      };

      const result = SecureObjectTransformer.transform(testObject);

      expect(result).toHaveProperty('valid_key', 'value1');
      expect(result).toHaveProperty('another.valid.key', 'value3');
      expect(result).not.toHaveProperty('invalid<key>');
    });
  });

  describe('Key Transformation', () => {
    it('should transform keys using provided transformer', () => {
      const obj = {
        "first_name": "John",
        "last_name": "Doe"
      };

      const camelCaseTransformer = (key: string) => {
        return key.replace(/([-_]\w)/g, (group) => group[1].toUpperCase());
      };

      const result = SecureObjectTransformer.transform(obj, {
        keyTransformer: camelCaseTransformer
      });

      expect(result).toHaveProperty('firstName', 'John');
      expect(result).toHaveProperty('lastName', 'Doe');
      expect(result).not.toHaveProperty('first_name');
      expect(result).not.toHaveProperty('last_name');
    });

    it('should validate transformed keys for safety', () => {
      const obj = {
        "safe_key": "value",
        "dangerous_key": "value2"
      };

      // Malicious transformer that tries to create dangerous keys
      const maliciousTransformer = (key: string) => {
        if (key === "dangerous_key") {
          return "__proto__";
        }
        return key;
      };

      const result = SecureObjectTransformer.transform(obj, {
        keyTransformer: maliciousTransformer
      });

      expect(result).toHaveProperty('safe_key', 'value');
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('dangerous_key');
    });

    it('should handle duplicate keys after transformation', () => {
      const obj = {
        "key_one": "value1",
        "key-one": "value2"
      };

      // Transformer that converts both to the same key
      const transformer = (key: string) => key.replace(/[-_]/g, '');

      const result = SecureObjectTransformer.transform(obj, {
        keyTransformer: transformer
      });

      // Should only have one key (first one wins)
      expect(Object.keys(result)).toHaveLength(1);
      expect(result).toHaveProperty('keyone', 'value1');
    });
  });

  describe('String Sanitization', () => {
    it('should sanitize strings when enabled', () => {
      const obj = {
        "field1": "normal string",
        "field2": "string with \0 null bytes",
        "field3": "very".repeat(3000) + " long string",
        "field4": "string with \x01 control chars \x1f"
      };

      const result = SecureObjectTransformer.transform(obj, {
        sanitizeStrings: true
      });

      expect(result.field1).toBe('normal string');
      expect(result.field2).toBe('string with  null bytes');
      expect(result.field3.length).toBeLessThanOrEqual(10000);
      expect(result.field4).toBe('string with  control chars ');
    });

    it('should not sanitize strings when disabled', () => {
      const obj = {
        "field1": "string with \0 null bytes"
      };

      const result = SecureObjectTransformer.transform(obj, {
        sanitizeStrings: false
      });

      expect(result.field1).toBe("string with \0 null bytes");
    });
  });

  describe('Array Handling', () => {
    it('should transform arrays recursively', () => {
      const obj = {
        "items": [
          { "item_name": "item1", "__proto__": { "polluted": true } },
          { "item_name": "item2", "valid_field": "value" }
        ]
      };

      const result = SecureObjectTransformer.transform(obj, {
        keyTransformer: (key) => key.replace(/_/g, '')
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('itemname', 'item1');
      expect(result.items[0]).not.toHaveProperty('__proto__');
      expect(result.items[1]).toHaveProperty('itemname', 'item2');
      expect(result.items[1]).toHaveProperty('validfield', 'value');
    });

    it('should handle nested arrays', () => {
      const obj = {
        "matrix": [
          [{ "x": 1, "y": 2 }],
          [{ "x": 3, "y": 4 }]
        ]
      };

      const result = SecureObjectTransformer.transform(obj);

      expect(result.matrix[0][0]).toHaveProperty('x', 1);
      expect(result.matrix[1][0]).toHaveProperty('y', 4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      const obj = {
        "null_field": null,
        "undefined_field": undefined,
        "zero": 0,
        "false": false,
        "empty_string": ""
      };

      const result = SecureObjectTransformer.transform(obj);

      expect(result.null_field).toBeNull();
      expect(result.undefined_field).toBeUndefined();
      expect(result.zero).toBe(0);
      expect(result.false).toBe(false);
      expect(result.empty_string).toBe("");
    });

    it('should handle primitive inputs', () => {
      expect(SecureObjectTransformer.transform("string")).toBe("string");
      expect(SecureObjectTransformer.transform(42)).toBe(42);
      expect(SecureObjectTransformer.transform(true)).toBe(true);
      expect(SecureObjectTransformer.transform(null)).toBeNull();
      expect(SecureObjectTransformer.transform(undefined)).toBeUndefined();
    });

    it('should create objects without prototype', () => {
      const obj = { "test": "value" };
      const result = SecureObjectTransformer.transform(obj);

      // Result should not inherit from Object.prototype
      expect(Object.getPrototypeOf(result)).toBeNull();
      expect(result.toString).toBeUndefined();
      expect(result.hasOwnProperty).toBeUndefined();
    });
  });

  describe('Object Safety Validation', () => {
    it('should detect circular references', () => {
      const obj: any = { name: "test" };
      obj.self = obj;

      expect(SecureObjectTransformer.isObjectSafe(obj)).toBe(false);
    });

    it('should pass safe objects', () => {
      const obj = {
        name: "test",
        nested: {
          value: 42
        }
      };

      expect(SecureObjectTransformer.isObjectSafe(obj)).toBe(true);
    });

    it('should handle primitive values as safe', () => {
      expect(SecureObjectTransformer.isObjectSafe("string")).toBe(true);
      expect(SecureObjectTransformer.isObjectSafe(42)).toBe(true);
      expect(SecureObjectTransformer.isObjectSafe(null)).toBe(true);
    });
  });
});