
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model GilmoursProduct
 * 
 */
export type GilmoursProduct = $Result.DefaultSelection<Prisma.$GilmoursProductPayload>
/**
 * Model BidfoodProduct
 * 
 */
export type BidfoodProduct = $Result.DefaultSelection<Prisma.$BidfoodProductPayload>
/**
 * Model OtherProduct
 * 
 */
export type OtherProduct = $Result.DefaultSelection<Prisma.$OtherProductPayload>
/**
 * Model Supplier
 * 
 */
export type Supplier = $Result.DefaultSelection<Prisma.$SupplierPayload>
/**
 * Model Component
 * 
 */
export type Component = $Result.DefaultSelection<Prisma.$ComponentPayload>
/**
 * Model Product
 * 
 */
export type Product = $Result.DefaultSelection<Prisma.$ProductPayload>
/**
 * Model Staff
 * 
 */
export type Staff = $Result.DefaultSelection<Prisma.$StaffPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more GilmoursProducts
 * const gilmoursProducts = await prisma.gilmoursProduct.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more GilmoursProducts
   * const gilmoursProducts = await prisma.gilmoursProduct.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.gilmoursProduct`: Exposes CRUD operations for the **GilmoursProduct** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GilmoursProducts
    * const gilmoursProducts = await prisma.gilmoursProduct.findMany()
    * ```
    */
  get gilmoursProduct(): Prisma.GilmoursProductDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.bidfoodProduct`: Exposes CRUD operations for the **BidfoodProduct** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more BidfoodProducts
    * const bidfoodProducts = await prisma.bidfoodProduct.findMany()
    * ```
    */
  get bidfoodProduct(): Prisma.BidfoodProductDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.otherProduct`: Exposes CRUD operations for the **OtherProduct** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more OtherProducts
    * const otherProducts = await prisma.otherProduct.findMany()
    * ```
    */
  get otherProduct(): Prisma.OtherProductDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.supplier`: Exposes CRUD operations for the **Supplier** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Suppliers
    * const suppliers = await prisma.supplier.findMany()
    * ```
    */
  get supplier(): Prisma.SupplierDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.component`: Exposes CRUD operations for the **Component** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Components
    * const components = await prisma.component.findMany()
    * ```
    */
  get component(): Prisma.ComponentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.product`: Exposes CRUD operations for the **Product** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Products
    * const products = await prisma.product.findMany()
    * ```
    */
  get product(): Prisma.ProductDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.staff`: Exposes CRUD operations for the **Staff** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Staff
    * const staff = await prisma.staff.findMany()
    * ```
    */
  get staff(): Prisma.StaffDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.6.0
   * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    GilmoursProduct: 'GilmoursProduct',
    BidfoodProduct: 'BidfoodProduct',
    OtherProduct: 'OtherProduct',
    Supplier: 'Supplier',
    Component: 'Component',
    Product: 'Product',
    Staff: 'Staff'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "gilmoursProduct" | "bidfoodProduct" | "otherProduct" | "supplier" | "component" | "product" | "staff"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      GilmoursProduct: {
        payload: Prisma.$GilmoursProductPayload<ExtArgs>
        fields: Prisma.GilmoursProductFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GilmoursProductFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GilmoursProductFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>
          }
          findFirst: {
            args: Prisma.GilmoursProductFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GilmoursProductFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>
          }
          findMany: {
            args: Prisma.GilmoursProductFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>[]
          }
          create: {
            args: Prisma.GilmoursProductCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>
          }
          createMany: {
            args: Prisma.GilmoursProductCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GilmoursProductCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>[]
          }
          delete: {
            args: Prisma.GilmoursProductDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>
          }
          update: {
            args: Prisma.GilmoursProductUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>
          }
          deleteMany: {
            args: Prisma.GilmoursProductDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GilmoursProductUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GilmoursProductUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>[]
          }
          upsert: {
            args: Prisma.GilmoursProductUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GilmoursProductPayload>
          }
          aggregate: {
            args: Prisma.GilmoursProductAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGilmoursProduct>
          }
          groupBy: {
            args: Prisma.GilmoursProductGroupByArgs<ExtArgs>
            result: $Utils.Optional<GilmoursProductGroupByOutputType>[]
          }
          count: {
            args: Prisma.GilmoursProductCountArgs<ExtArgs>
            result: $Utils.Optional<GilmoursProductCountAggregateOutputType> | number
          }
        }
      }
      BidfoodProduct: {
        payload: Prisma.$BidfoodProductPayload<ExtArgs>
        fields: Prisma.BidfoodProductFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BidfoodProductFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BidfoodProductFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>
          }
          findFirst: {
            args: Prisma.BidfoodProductFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BidfoodProductFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>
          }
          findMany: {
            args: Prisma.BidfoodProductFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>[]
          }
          create: {
            args: Prisma.BidfoodProductCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>
          }
          createMany: {
            args: Prisma.BidfoodProductCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BidfoodProductCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>[]
          }
          delete: {
            args: Prisma.BidfoodProductDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>
          }
          update: {
            args: Prisma.BidfoodProductUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>
          }
          deleteMany: {
            args: Prisma.BidfoodProductDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BidfoodProductUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.BidfoodProductUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>[]
          }
          upsert: {
            args: Prisma.BidfoodProductUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BidfoodProductPayload>
          }
          aggregate: {
            args: Prisma.BidfoodProductAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBidfoodProduct>
          }
          groupBy: {
            args: Prisma.BidfoodProductGroupByArgs<ExtArgs>
            result: $Utils.Optional<BidfoodProductGroupByOutputType>[]
          }
          count: {
            args: Prisma.BidfoodProductCountArgs<ExtArgs>
            result: $Utils.Optional<BidfoodProductCountAggregateOutputType> | number
          }
        }
      }
      OtherProduct: {
        payload: Prisma.$OtherProductPayload<ExtArgs>
        fields: Prisma.OtherProductFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OtherProductFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OtherProductFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>
          }
          findFirst: {
            args: Prisma.OtherProductFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OtherProductFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>
          }
          findMany: {
            args: Prisma.OtherProductFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>[]
          }
          create: {
            args: Prisma.OtherProductCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>
          }
          createMany: {
            args: Prisma.OtherProductCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OtherProductCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>[]
          }
          delete: {
            args: Prisma.OtherProductDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>
          }
          update: {
            args: Prisma.OtherProductUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>
          }
          deleteMany: {
            args: Prisma.OtherProductDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OtherProductUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.OtherProductUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>[]
          }
          upsert: {
            args: Prisma.OtherProductUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OtherProductPayload>
          }
          aggregate: {
            args: Prisma.OtherProductAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOtherProduct>
          }
          groupBy: {
            args: Prisma.OtherProductGroupByArgs<ExtArgs>
            result: $Utils.Optional<OtherProductGroupByOutputType>[]
          }
          count: {
            args: Prisma.OtherProductCountArgs<ExtArgs>
            result: $Utils.Optional<OtherProductCountAggregateOutputType> | number
          }
        }
      }
      Supplier: {
        payload: Prisma.$SupplierPayload<ExtArgs>
        fields: Prisma.SupplierFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SupplierFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SupplierFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>
          }
          findFirst: {
            args: Prisma.SupplierFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SupplierFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>
          }
          findMany: {
            args: Prisma.SupplierFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>[]
          }
          create: {
            args: Prisma.SupplierCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>
          }
          createMany: {
            args: Prisma.SupplierCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SupplierCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>[]
          }
          delete: {
            args: Prisma.SupplierDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>
          }
          update: {
            args: Prisma.SupplierUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>
          }
          deleteMany: {
            args: Prisma.SupplierDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SupplierUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SupplierUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>[]
          }
          upsert: {
            args: Prisma.SupplierUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierPayload>
          }
          aggregate: {
            args: Prisma.SupplierAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSupplier>
          }
          groupBy: {
            args: Prisma.SupplierGroupByArgs<ExtArgs>
            result: $Utils.Optional<SupplierGroupByOutputType>[]
          }
          count: {
            args: Prisma.SupplierCountArgs<ExtArgs>
            result: $Utils.Optional<SupplierCountAggregateOutputType> | number
          }
        }
      }
      Component: {
        payload: Prisma.$ComponentPayload<ExtArgs>
        fields: Prisma.ComponentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ComponentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ComponentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>
          }
          findFirst: {
            args: Prisma.ComponentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ComponentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>
          }
          findMany: {
            args: Prisma.ComponentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>[]
          }
          create: {
            args: Prisma.ComponentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>
          }
          createMany: {
            args: Prisma.ComponentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ComponentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>[]
          }
          delete: {
            args: Prisma.ComponentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>
          }
          update: {
            args: Prisma.ComponentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>
          }
          deleteMany: {
            args: Prisma.ComponentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ComponentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ComponentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>[]
          }
          upsert: {
            args: Prisma.ComponentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ComponentPayload>
          }
          aggregate: {
            args: Prisma.ComponentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateComponent>
          }
          groupBy: {
            args: Prisma.ComponentGroupByArgs<ExtArgs>
            result: $Utils.Optional<ComponentGroupByOutputType>[]
          }
          count: {
            args: Prisma.ComponentCountArgs<ExtArgs>
            result: $Utils.Optional<ComponentCountAggregateOutputType> | number
          }
        }
      }
      Product: {
        payload: Prisma.$ProductPayload<ExtArgs>
        fields: Prisma.ProductFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProductFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProductFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          findFirst: {
            args: Prisma.ProductFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProductFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          findMany: {
            args: Prisma.ProductFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>[]
          }
          create: {
            args: Prisma.ProductCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          createMany: {
            args: Prisma.ProductCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ProductCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>[]
          }
          delete: {
            args: Prisma.ProductDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          update: {
            args: Prisma.ProductUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          deleteMany: {
            args: Prisma.ProductDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ProductUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ProductUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>[]
          }
          upsert: {
            args: Prisma.ProductUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProductPayload>
          }
          aggregate: {
            args: Prisma.ProductAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateProduct>
          }
          groupBy: {
            args: Prisma.ProductGroupByArgs<ExtArgs>
            result: $Utils.Optional<ProductGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProductCountArgs<ExtArgs>
            result: $Utils.Optional<ProductCountAggregateOutputType> | number
          }
        }
      }
      Staff: {
        payload: Prisma.$StaffPayload<ExtArgs>
        fields: Prisma.StaffFieldRefs
        operations: {
          findUnique: {
            args: Prisma.StaffFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.StaffFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>
          }
          findFirst: {
            args: Prisma.StaffFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.StaffFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>
          }
          findMany: {
            args: Prisma.StaffFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>[]
          }
          create: {
            args: Prisma.StaffCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>
          }
          createMany: {
            args: Prisma.StaffCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.StaffCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>[]
          }
          delete: {
            args: Prisma.StaffDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>
          }
          update: {
            args: Prisma.StaffUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>
          }
          deleteMany: {
            args: Prisma.StaffDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.StaffUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.StaffUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>[]
          }
          upsert: {
            args: Prisma.StaffUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StaffPayload>
          }
          aggregate: {
            args: Prisma.StaffAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateStaff>
          }
          groupBy: {
            args: Prisma.StaffGroupByArgs<ExtArgs>
            result: $Utils.Optional<StaffGroupByOutputType>[]
          }
          count: {
            args: Prisma.StaffCountArgs<ExtArgs>
            result: $Utils.Optional<StaffCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    gilmoursProduct?: GilmoursProductOmit
    bidfoodProduct?: BidfoodProductOmit
    otherProduct?: OtherProductOmit
    supplier?: SupplierOmit
    component?: ComponentOmit
    product?: ProductOmit
    staff?: StaffOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model GilmoursProduct
   */

  export type AggregateGilmoursProduct = {
    _count: GilmoursProductCountAggregateOutputType | null
    _avg: GilmoursProductAvgAggregateOutputType | null
    _sum: GilmoursProductSumAggregateOutputType | null
    _min: GilmoursProductMinAggregateOutputType | null
    _max: GilmoursProductMaxAggregateOutputType | null
  }

  export type GilmoursProductAvgAggregateOutputType = {
    price: number | null
    quantity: number | null
  }

  export type GilmoursProductSumAggregateOutputType = {
    price: number | null
    quantity: number | null
  }

  export type GilmoursProductMinAggregateOutputType = {
    id: string | null
    sku: string | null
    brand: string | null
    description: string | null
    packSize: string | null
    uom: string | null
    price: number | null
    quantity: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GilmoursProductMaxAggregateOutputType = {
    id: string | null
    sku: string | null
    brand: string | null
    description: string | null
    packSize: string | null
    uom: string | null
    price: number | null
    quantity: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GilmoursProductCountAggregateOutputType = {
    id: number
    sku: number
    brand: number
    description: number
    packSize: number
    uom: number
    price: number
    quantity: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type GilmoursProductAvgAggregateInputType = {
    price?: true
    quantity?: true
  }

  export type GilmoursProductSumAggregateInputType = {
    price?: true
    quantity?: true
  }

  export type GilmoursProductMinAggregateInputType = {
    id?: true
    sku?: true
    brand?: true
    description?: true
    packSize?: true
    uom?: true
    price?: true
    quantity?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GilmoursProductMaxAggregateInputType = {
    id?: true
    sku?: true
    brand?: true
    description?: true
    packSize?: true
    uom?: true
    price?: true
    quantity?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GilmoursProductCountAggregateInputType = {
    id?: true
    sku?: true
    brand?: true
    description?: true
    packSize?: true
    uom?: true
    price?: true
    quantity?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type GilmoursProductAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GilmoursProduct to aggregate.
     */
    where?: GilmoursProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GilmoursProducts to fetch.
     */
    orderBy?: GilmoursProductOrderByWithRelationInput | GilmoursProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GilmoursProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GilmoursProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GilmoursProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GilmoursProducts
    **/
    _count?: true | GilmoursProductCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: GilmoursProductAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: GilmoursProductSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GilmoursProductMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GilmoursProductMaxAggregateInputType
  }

  export type GetGilmoursProductAggregateType<T extends GilmoursProductAggregateArgs> = {
        [P in keyof T & keyof AggregateGilmoursProduct]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGilmoursProduct[P]>
      : GetScalarType<T[P], AggregateGilmoursProduct[P]>
  }




  export type GilmoursProductGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GilmoursProductWhereInput
    orderBy?: GilmoursProductOrderByWithAggregationInput | GilmoursProductOrderByWithAggregationInput[]
    by: GilmoursProductScalarFieldEnum[] | GilmoursProductScalarFieldEnum
    having?: GilmoursProductScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GilmoursProductCountAggregateInputType | true
    _avg?: GilmoursProductAvgAggregateInputType
    _sum?: GilmoursProductSumAggregateInputType
    _min?: GilmoursProductMinAggregateInputType
    _max?: GilmoursProductMaxAggregateInputType
  }

  export type GilmoursProductGroupByOutputType = {
    id: string
    sku: string
    brand: string
    description: string
    packSize: string
    uom: string
    price: number
    quantity: number
    createdAt: Date
    updatedAt: Date
    _count: GilmoursProductCountAggregateOutputType | null
    _avg: GilmoursProductAvgAggregateOutputType | null
    _sum: GilmoursProductSumAggregateOutputType | null
    _min: GilmoursProductMinAggregateOutputType | null
    _max: GilmoursProductMaxAggregateOutputType | null
  }

  type GetGilmoursProductGroupByPayload<T extends GilmoursProductGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GilmoursProductGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GilmoursProductGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GilmoursProductGroupByOutputType[P]>
            : GetScalarType<T[P], GilmoursProductGroupByOutputType[P]>
        }
      >
    >


  export type GilmoursProductSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sku?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    uom?: boolean
    price?: boolean
    quantity?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["gilmoursProduct"]>

  export type GilmoursProductSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sku?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    uom?: boolean
    price?: boolean
    quantity?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["gilmoursProduct"]>

  export type GilmoursProductSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    sku?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    uom?: boolean
    price?: boolean
    quantity?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["gilmoursProduct"]>

  export type GilmoursProductSelectScalar = {
    id?: boolean
    sku?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    uom?: boolean
    price?: boolean
    quantity?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type GilmoursProductOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "sku" | "brand" | "description" | "packSize" | "uom" | "price" | "quantity" | "createdAt" | "updatedAt", ExtArgs["result"]["gilmoursProduct"]>

  export type $GilmoursProductPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GilmoursProduct"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      sku: string
      brand: string
      description: string
      packSize: string
      uom: string
      price: number
      quantity: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["gilmoursProduct"]>
    composites: {}
  }

  type GilmoursProductGetPayload<S extends boolean | null | undefined | GilmoursProductDefaultArgs> = $Result.GetResult<Prisma.$GilmoursProductPayload, S>

  type GilmoursProductCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GilmoursProductFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GilmoursProductCountAggregateInputType | true
    }

  export interface GilmoursProductDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GilmoursProduct'], meta: { name: 'GilmoursProduct' } }
    /**
     * Find zero or one GilmoursProduct that matches the filter.
     * @param {GilmoursProductFindUniqueArgs} args - Arguments to find a GilmoursProduct
     * @example
     * // Get one GilmoursProduct
     * const gilmoursProduct = await prisma.gilmoursProduct.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GilmoursProductFindUniqueArgs>(args: SelectSubset<T, GilmoursProductFindUniqueArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GilmoursProduct that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GilmoursProductFindUniqueOrThrowArgs} args - Arguments to find a GilmoursProduct
     * @example
     * // Get one GilmoursProduct
     * const gilmoursProduct = await prisma.gilmoursProduct.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GilmoursProductFindUniqueOrThrowArgs>(args: SelectSubset<T, GilmoursProductFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GilmoursProduct that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductFindFirstArgs} args - Arguments to find a GilmoursProduct
     * @example
     * // Get one GilmoursProduct
     * const gilmoursProduct = await prisma.gilmoursProduct.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GilmoursProductFindFirstArgs>(args?: SelectSubset<T, GilmoursProductFindFirstArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GilmoursProduct that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductFindFirstOrThrowArgs} args - Arguments to find a GilmoursProduct
     * @example
     * // Get one GilmoursProduct
     * const gilmoursProduct = await prisma.gilmoursProduct.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GilmoursProductFindFirstOrThrowArgs>(args?: SelectSubset<T, GilmoursProductFindFirstOrThrowArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GilmoursProducts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GilmoursProducts
     * const gilmoursProducts = await prisma.gilmoursProduct.findMany()
     * 
     * // Get first 10 GilmoursProducts
     * const gilmoursProducts = await prisma.gilmoursProduct.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const gilmoursProductWithIdOnly = await prisma.gilmoursProduct.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GilmoursProductFindManyArgs>(args?: SelectSubset<T, GilmoursProductFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GilmoursProduct.
     * @param {GilmoursProductCreateArgs} args - Arguments to create a GilmoursProduct.
     * @example
     * // Create one GilmoursProduct
     * const GilmoursProduct = await prisma.gilmoursProduct.create({
     *   data: {
     *     // ... data to create a GilmoursProduct
     *   }
     * })
     * 
     */
    create<T extends GilmoursProductCreateArgs>(args: SelectSubset<T, GilmoursProductCreateArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GilmoursProducts.
     * @param {GilmoursProductCreateManyArgs} args - Arguments to create many GilmoursProducts.
     * @example
     * // Create many GilmoursProducts
     * const gilmoursProduct = await prisma.gilmoursProduct.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GilmoursProductCreateManyArgs>(args?: SelectSubset<T, GilmoursProductCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GilmoursProducts and returns the data saved in the database.
     * @param {GilmoursProductCreateManyAndReturnArgs} args - Arguments to create many GilmoursProducts.
     * @example
     * // Create many GilmoursProducts
     * const gilmoursProduct = await prisma.gilmoursProduct.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GilmoursProducts and only return the `id`
     * const gilmoursProductWithIdOnly = await prisma.gilmoursProduct.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GilmoursProductCreateManyAndReturnArgs>(args?: SelectSubset<T, GilmoursProductCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GilmoursProduct.
     * @param {GilmoursProductDeleteArgs} args - Arguments to delete one GilmoursProduct.
     * @example
     * // Delete one GilmoursProduct
     * const GilmoursProduct = await prisma.gilmoursProduct.delete({
     *   where: {
     *     // ... filter to delete one GilmoursProduct
     *   }
     * })
     * 
     */
    delete<T extends GilmoursProductDeleteArgs>(args: SelectSubset<T, GilmoursProductDeleteArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GilmoursProduct.
     * @param {GilmoursProductUpdateArgs} args - Arguments to update one GilmoursProduct.
     * @example
     * // Update one GilmoursProduct
     * const gilmoursProduct = await prisma.gilmoursProduct.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GilmoursProductUpdateArgs>(args: SelectSubset<T, GilmoursProductUpdateArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GilmoursProducts.
     * @param {GilmoursProductDeleteManyArgs} args - Arguments to filter GilmoursProducts to delete.
     * @example
     * // Delete a few GilmoursProducts
     * const { count } = await prisma.gilmoursProduct.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GilmoursProductDeleteManyArgs>(args?: SelectSubset<T, GilmoursProductDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GilmoursProducts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GilmoursProducts
     * const gilmoursProduct = await prisma.gilmoursProduct.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GilmoursProductUpdateManyArgs>(args: SelectSubset<T, GilmoursProductUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GilmoursProducts and returns the data updated in the database.
     * @param {GilmoursProductUpdateManyAndReturnArgs} args - Arguments to update many GilmoursProducts.
     * @example
     * // Update many GilmoursProducts
     * const gilmoursProduct = await prisma.gilmoursProduct.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GilmoursProducts and only return the `id`
     * const gilmoursProductWithIdOnly = await prisma.gilmoursProduct.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends GilmoursProductUpdateManyAndReturnArgs>(args: SelectSubset<T, GilmoursProductUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GilmoursProduct.
     * @param {GilmoursProductUpsertArgs} args - Arguments to update or create a GilmoursProduct.
     * @example
     * // Update or create a GilmoursProduct
     * const gilmoursProduct = await prisma.gilmoursProduct.upsert({
     *   create: {
     *     // ... data to create a GilmoursProduct
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GilmoursProduct we want to update
     *   }
     * })
     */
    upsert<T extends GilmoursProductUpsertArgs>(args: SelectSubset<T, GilmoursProductUpsertArgs<ExtArgs>>): Prisma__GilmoursProductClient<$Result.GetResult<Prisma.$GilmoursProductPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GilmoursProducts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductCountArgs} args - Arguments to filter GilmoursProducts to count.
     * @example
     * // Count the number of GilmoursProducts
     * const count = await prisma.gilmoursProduct.count({
     *   where: {
     *     // ... the filter for the GilmoursProducts we want to count
     *   }
     * })
    **/
    count<T extends GilmoursProductCountArgs>(
      args?: Subset<T, GilmoursProductCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GilmoursProductCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GilmoursProduct.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends GilmoursProductAggregateArgs>(args: Subset<T, GilmoursProductAggregateArgs>): Prisma.PrismaPromise<GetGilmoursProductAggregateType<T>>

    /**
     * Group by GilmoursProduct.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GilmoursProductGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends GilmoursProductGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GilmoursProductGroupByArgs['orderBy'] }
        : { orderBy?: GilmoursProductGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, GilmoursProductGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGilmoursProductGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GilmoursProduct model
   */
  readonly fields: GilmoursProductFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GilmoursProduct.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GilmoursProductClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the GilmoursProduct model
   */
  interface GilmoursProductFieldRefs {
    readonly id: FieldRef<"GilmoursProduct", 'String'>
    readonly sku: FieldRef<"GilmoursProduct", 'String'>
    readonly brand: FieldRef<"GilmoursProduct", 'String'>
    readonly description: FieldRef<"GilmoursProduct", 'String'>
    readonly packSize: FieldRef<"GilmoursProduct", 'String'>
    readonly uom: FieldRef<"GilmoursProduct", 'String'>
    readonly price: FieldRef<"GilmoursProduct", 'Float'>
    readonly quantity: FieldRef<"GilmoursProduct", 'Int'>
    readonly createdAt: FieldRef<"GilmoursProduct", 'DateTime'>
    readonly updatedAt: FieldRef<"GilmoursProduct", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GilmoursProduct findUnique
   */
  export type GilmoursProductFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * Filter, which GilmoursProduct to fetch.
     */
    where: GilmoursProductWhereUniqueInput
  }

  /**
   * GilmoursProduct findUniqueOrThrow
   */
  export type GilmoursProductFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * Filter, which GilmoursProduct to fetch.
     */
    where: GilmoursProductWhereUniqueInput
  }

  /**
   * GilmoursProduct findFirst
   */
  export type GilmoursProductFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * Filter, which GilmoursProduct to fetch.
     */
    where?: GilmoursProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GilmoursProducts to fetch.
     */
    orderBy?: GilmoursProductOrderByWithRelationInput | GilmoursProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GilmoursProducts.
     */
    cursor?: GilmoursProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GilmoursProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GilmoursProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GilmoursProducts.
     */
    distinct?: GilmoursProductScalarFieldEnum | GilmoursProductScalarFieldEnum[]
  }

  /**
   * GilmoursProduct findFirstOrThrow
   */
  export type GilmoursProductFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * Filter, which GilmoursProduct to fetch.
     */
    where?: GilmoursProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GilmoursProducts to fetch.
     */
    orderBy?: GilmoursProductOrderByWithRelationInput | GilmoursProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GilmoursProducts.
     */
    cursor?: GilmoursProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GilmoursProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GilmoursProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GilmoursProducts.
     */
    distinct?: GilmoursProductScalarFieldEnum | GilmoursProductScalarFieldEnum[]
  }

  /**
   * GilmoursProduct findMany
   */
  export type GilmoursProductFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * Filter, which GilmoursProducts to fetch.
     */
    where?: GilmoursProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GilmoursProducts to fetch.
     */
    orderBy?: GilmoursProductOrderByWithRelationInput | GilmoursProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GilmoursProducts.
     */
    cursor?: GilmoursProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GilmoursProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GilmoursProducts.
     */
    skip?: number
    distinct?: GilmoursProductScalarFieldEnum | GilmoursProductScalarFieldEnum[]
  }

  /**
   * GilmoursProduct create
   */
  export type GilmoursProductCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * The data needed to create a GilmoursProduct.
     */
    data: XOR<GilmoursProductCreateInput, GilmoursProductUncheckedCreateInput>
  }

  /**
   * GilmoursProduct createMany
   */
  export type GilmoursProductCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GilmoursProducts.
     */
    data: GilmoursProductCreateManyInput | GilmoursProductCreateManyInput[]
  }

  /**
   * GilmoursProduct createManyAndReturn
   */
  export type GilmoursProductCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * The data used to create many GilmoursProducts.
     */
    data: GilmoursProductCreateManyInput | GilmoursProductCreateManyInput[]
  }

  /**
   * GilmoursProduct update
   */
  export type GilmoursProductUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * The data needed to update a GilmoursProduct.
     */
    data: XOR<GilmoursProductUpdateInput, GilmoursProductUncheckedUpdateInput>
    /**
     * Choose, which GilmoursProduct to update.
     */
    where: GilmoursProductWhereUniqueInput
  }

  /**
   * GilmoursProduct updateMany
   */
  export type GilmoursProductUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GilmoursProducts.
     */
    data: XOR<GilmoursProductUpdateManyMutationInput, GilmoursProductUncheckedUpdateManyInput>
    /**
     * Filter which GilmoursProducts to update
     */
    where?: GilmoursProductWhereInput
    /**
     * Limit how many GilmoursProducts to update.
     */
    limit?: number
  }

  /**
   * GilmoursProduct updateManyAndReturn
   */
  export type GilmoursProductUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * The data used to update GilmoursProducts.
     */
    data: XOR<GilmoursProductUpdateManyMutationInput, GilmoursProductUncheckedUpdateManyInput>
    /**
     * Filter which GilmoursProducts to update
     */
    where?: GilmoursProductWhereInput
    /**
     * Limit how many GilmoursProducts to update.
     */
    limit?: number
  }

  /**
   * GilmoursProduct upsert
   */
  export type GilmoursProductUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * The filter to search for the GilmoursProduct to update in case it exists.
     */
    where: GilmoursProductWhereUniqueInput
    /**
     * In case the GilmoursProduct found by the `where` argument doesn't exist, create a new GilmoursProduct with this data.
     */
    create: XOR<GilmoursProductCreateInput, GilmoursProductUncheckedCreateInput>
    /**
     * In case the GilmoursProduct was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GilmoursProductUpdateInput, GilmoursProductUncheckedUpdateInput>
  }

  /**
   * GilmoursProduct delete
   */
  export type GilmoursProductDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
    /**
     * Filter which GilmoursProduct to delete.
     */
    where: GilmoursProductWhereUniqueInput
  }

  /**
   * GilmoursProduct deleteMany
   */
  export type GilmoursProductDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GilmoursProducts to delete
     */
    where?: GilmoursProductWhereInput
    /**
     * Limit how many GilmoursProducts to delete.
     */
    limit?: number
  }

  /**
   * GilmoursProduct without action
   */
  export type GilmoursProductDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GilmoursProduct
     */
    select?: GilmoursProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GilmoursProduct
     */
    omit?: GilmoursProductOmit<ExtArgs> | null
  }


  /**
   * Model BidfoodProduct
   */

  export type AggregateBidfoodProduct = {
    _count: BidfoodProductCountAggregateOutputType | null
    _avg: BidfoodProductAvgAggregateOutputType | null
    _sum: BidfoodProductSumAggregateOutputType | null
    _min: BidfoodProductMinAggregateOutputType | null
    _max: BidfoodProductMaxAggregateOutputType | null
  }

  export type BidfoodProductAvgAggregateOutputType = {
    qty: number | null
    lastPricePaid: number | null
    totalExGST: number | null
  }

  export type BidfoodProductSumAggregateOutputType = {
    qty: number | null
    lastPricePaid: number | null
    totalExGST: number | null
  }

  export type BidfoodProductMinAggregateOutputType = {
    id: string | null
    productCode: string | null
    brand: string | null
    description: string | null
    packSize: string | null
    ctnQty: string | null
    uom: string | null
    qty: number | null
    lastPricePaid: number | null
    totalExGST: number | null
    contains: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BidfoodProductMaxAggregateOutputType = {
    id: string | null
    productCode: string | null
    brand: string | null
    description: string | null
    packSize: string | null
    ctnQty: string | null
    uom: string | null
    qty: number | null
    lastPricePaid: number | null
    totalExGST: number | null
    contains: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BidfoodProductCountAggregateOutputType = {
    id: number
    productCode: number
    brand: number
    description: number
    packSize: number
    ctnQty: number
    uom: number
    qty: number
    lastPricePaid: number
    totalExGST: number
    contains: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type BidfoodProductAvgAggregateInputType = {
    qty?: true
    lastPricePaid?: true
    totalExGST?: true
  }

  export type BidfoodProductSumAggregateInputType = {
    qty?: true
    lastPricePaid?: true
    totalExGST?: true
  }

  export type BidfoodProductMinAggregateInputType = {
    id?: true
    productCode?: true
    brand?: true
    description?: true
    packSize?: true
    ctnQty?: true
    uom?: true
    qty?: true
    lastPricePaid?: true
    totalExGST?: true
    contains?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BidfoodProductMaxAggregateInputType = {
    id?: true
    productCode?: true
    brand?: true
    description?: true
    packSize?: true
    ctnQty?: true
    uom?: true
    qty?: true
    lastPricePaid?: true
    totalExGST?: true
    contains?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BidfoodProductCountAggregateInputType = {
    id?: true
    productCode?: true
    brand?: true
    description?: true
    packSize?: true
    ctnQty?: true
    uom?: true
    qty?: true
    lastPricePaid?: true
    totalExGST?: true
    contains?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type BidfoodProductAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BidfoodProduct to aggregate.
     */
    where?: BidfoodProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BidfoodProducts to fetch.
     */
    orderBy?: BidfoodProductOrderByWithRelationInput | BidfoodProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BidfoodProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BidfoodProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BidfoodProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned BidfoodProducts
    **/
    _count?: true | BidfoodProductCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: BidfoodProductAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: BidfoodProductSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BidfoodProductMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BidfoodProductMaxAggregateInputType
  }

  export type GetBidfoodProductAggregateType<T extends BidfoodProductAggregateArgs> = {
        [P in keyof T & keyof AggregateBidfoodProduct]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBidfoodProduct[P]>
      : GetScalarType<T[P], AggregateBidfoodProduct[P]>
  }




  export type BidfoodProductGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BidfoodProductWhereInput
    orderBy?: BidfoodProductOrderByWithAggregationInput | BidfoodProductOrderByWithAggregationInput[]
    by: BidfoodProductScalarFieldEnum[] | BidfoodProductScalarFieldEnum
    having?: BidfoodProductScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BidfoodProductCountAggregateInputType | true
    _avg?: BidfoodProductAvgAggregateInputType
    _sum?: BidfoodProductSumAggregateInputType
    _min?: BidfoodProductMinAggregateInputType
    _max?: BidfoodProductMaxAggregateInputType
  }

  export type BidfoodProductGroupByOutputType = {
    id: string
    productCode: string
    brand: string
    description: string
    packSize: string
    ctnQty: string
    uom: string
    qty: number
    lastPricePaid: number
    totalExGST: number
    contains: string
    createdAt: Date
    updatedAt: Date
    _count: BidfoodProductCountAggregateOutputType | null
    _avg: BidfoodProductAvgAggregateOutputType | null
    _sum: BidfoodProductSumAggregateOutputType | null
    _min: BidfoodProductMinAggregateOutputType | null
    _max: BidfoodProductMaxAggregateOutputType | null
  }

  type GetBidfoodProductGroupByPayload<T extends BidfoodProductGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BidfoodProductGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BidfoodProductGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BidfoodProductGroupByOutputType[P]>
            : GetScalarType<T[P], BidfoodProductGroupByOutputType[P]>
        }
      >
    >


  export type BidfoodProductSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    productCode?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    ctnQty?: boolean
    uom?: boolean
    qty?: boolean
    lastPricePaid?: boolean
    totalExGST?: boolean
    contains?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["bidfoodProduct"]>

  export type BidfoodProductSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    productCode?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    ctnQty?: boolean
    uom?: boolean
    qty?: boolean
    lastPricePaid?: boolean
    totalExGST?: boolean
    contains?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["bidfoodProduct"]>

  export type BidfoodProductSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    productCode?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    ctnQty?: boolean
    uom?: boolean
    qty?: boolean
    lastPricePaid?: boolean
    totalExGST?: boolean
    contains?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["bidfoodProduct"]>

  export type BidfoodProductSelectScalar = {
    id?: boolean
    productCode?: boolean
    brand?: boolean
    description?: boolean
    packSize?: boolean
    ctnQty?: boolean
    uom?: boolean
    qty?: boolean
    lastPricePaid?: boolean
    totalExGST?: boolean
    contains?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type BidfoodProductOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "productCode" | "brand" | "description" | "packSize" | "ctnQty" | "uom" | "qty" | "lastPricePaid" | "totalExGST" | "contains" | "createdAt" | "updatedAt", ExtArgs["result"]["bidfoodProduct"]>

  export type $BidfoodProductPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "BidfoodProduct"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      productCode: string
      brand: string
      description: string
      packSize: string
      ctnQty: string
      uom: string
      qty: number
      lastPricePaid: number
      totalExGST: number
      contains: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["bidfoodProduct"]>
    composites: {}
  }

  type BidfoodProductGetPayload<S extends boolean | null | undefined | BidfoodProductDefaultArgs> = $Result.GetResult<Prisma.$BidfoodProductPayload, S>

  type BidfoodProductCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<BidfoodProductFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: BidfoodProductCountAggregateInputType | true
    }

  export interface BidfoodProductDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['BidfoodProduct'], meta: { name: 'BidfoodProduct' } }
    /**
     * Find zero or one BidfoodProduct that matches the filter.
     * @param {BidfoodProductFindUniqueArgs} args - Arguments to find a BidfoodProduct
     * @example
     * // Get one BidfoodProduct
     * const bidfoodProduct = await prisma.bidfoodProduct.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BidfoodProductFindUniqueArgs>(args: SelectSubset<T, BidfoodProductFindUniqueArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one BidfoodProduct that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BidfoodProductFindUniqueOrThrowArgs} args - Arguments to find a BidfoodProduct
     * @example
     * // Get one BidfoodProduct
     * const bidfoodProduct = await prisma.bidfoodProduct.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BidfoodProductFindUniqueOrThrowArgs>(args: SelectSubset<T, BidfoodProductFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BidfoodProduct that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductFindFirstArgs} args - Arguments to find a BidfoodProduct
     * @example
     * // Get one BidfoodProduct
     * const bidfoodProduct = await prisma.bidfoodProduct.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BidfoodProductFindFirstArgs>(args?: SelectSubset<T, BidfoodProductFindFirstArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first BidfoodProduct that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductFindFirstOrThrowArgs} args - Arguments to find a BidfoodProduct
     * @example
     * // Get one BidfoodProduct
     * const bidfoodProduct = await prisma.bidfoodProduct.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BidfoodProductFindFirstOrThrowArgs>(args?: SelectSubset<T, BidfoodProductFindFirstOrThrowArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more BidfoodProducts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all BidfoodProducts
     * const bidfoodProducts = await prisma.bidfoodProduct.findMany()
     * 
     * // Get first 10 BidfoodProducts
     * const bidfoodProducts = await prisma.bidfoodProduct.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const bidfoodProductWithIdOnly = await prisma.bidfoodProduct.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BidfoodProductFindManyArgs>(args?: SelectSubset<T, BidfoodProductFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a BidfoodProduct.
     * @param {BidfoodProductCreateArgs} args - Arguments to create a BidfoodProduct.
     * @example
     * // Create one BidfoodProduct
     * const BidfoodProduct = await prisma.bidfoodProduct.create({
     *   data: {
     *     // ... data to create a BidfoodProduct
     *   }
     * })
     * 
     */
    create<T extends BidfoodProductCreateArgs>(args: SelectSubset<T, BidfoodProductCreateArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many BidfoodProducts.
     * @param {BidfoodProductCreateManyArgs} args - Arguments to create many BidfoodProducts.
     * @example
     * // Create many BidfoodProducts
     * const bidfoodProduct = await prisma.bidfoodProduct.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BidfoodProductCreateManyArgs>(args?: SelectSubset<T, BidfoodProductCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many BidfoodProducts and returns the data saved in the database.
     * @param {BidfoodProductCreateManyAndReturnArgs} args - Arguments to create many BidfoodProducts.
     * @example
     * // Create many BidfoodProducts
     * const bidfoodProduct = await prisma.bidfoodProduct.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many BidfoodProducts and only return the `id`
     * const bidfoodProductWithIdOnly = await prisma.bidfoodProduct.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BidfoodProductCreateManyAndReturnArgs>(args?: SelectSubset<T, BidfoodProductCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a BidfoodProduct.
     * @param {BidfoodProductDeleteArgs} args - Arguments to delete one BidfoodProduct.
     * @example
     * // Delete one BidfoodProduct
     * const BidfoodProduct = await prisma.bidfoodProduct.delete({
     *   where: {
     *     // ... filter to delete one BidfoodProduct
     *   }
     * })
     * 
     */
    delete<T extends BidfoodProductDeleteArgs>(args: SelectSubset<T, BidfoodProductDeleteArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one BidfoodProduct.
     * @param {BidfoodProductUpdateArgs} args - Arguments to update one BidfoodProduct.
     * @example
     * // Update one BidfoodProduct
     * const bidfoodProduct = await prisma.bidfoodProduct.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BidfoodProductUpdateArgs>(args: SelectSubset<T, BidfoodProductUpdateArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more BidfoodProducts.
     * @param {BidfoodProductDeleteManyArgs} args - Arguments to filter BidfoodProducts to delete.
     * @example
     * // Delete a few BidfoodProducts
     * const { count } = await prisma.bidfoodProduct.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BidfoodProductDeleteManyArgs>(args?: SelectSubset<T, BidfoodProductDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BidfoodProducts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many BidfoodProducts
     * const bidfoodProduct = await prisma.bidfoodProduct.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BidfoodProductUpdateManyArgs>(args: SelectSubset<T, BidfoodProductUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more BidfoodProducts and returns the data updated in the database.
     * @param {BidfoodProductUpdateManyAndReturnArgs} args - Arguments to update many BidfoodProducts.
     * @example
     * // Update many BidfoodProducts
     * const bidfoodProduct = await prisma.bidfoodProduct.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more BidfoodProducts and only return the `id`
     * const bidfoodProductWithIdOnly = await prisma.bidfoodProduct.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends BidfoodProductUpdateManyAndReturnArgs>(args: SelectSubset<T, BidfoodProductUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one BidfoodProduct.
     * @param {BidfoodProductUpsertArgs} args - Arguments to update or create a BidfoodProduct.
     * @example
     * // Update or create a BidfoodProduct
     * const bidfoodProduct = await prisma.bidfoodProduct.upsert({
     *   create: {
     *     // ... data to create a BidfoodProduct
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the BidfoodProduct we want to update
     *   }
     * })
     */
    upsert<T extends BidfoodProductUpsertArgs>(args: SelectSubset<T, BidfoodProductUpsertArgs<ExtArgs>>): Prisma__BidfoodProductClient<$Result.GetResult<Prisma.$BidfoodProductPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of BidfoodProducts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductCountArgs} args - Arguments to filter BidfoodProducts to count.
     * @example
     * // Count the number of BidfoodProducts
     * const count = await prisma.bidfoodProduct.count({
     *   where: {
     *     // ... the filter for the BidfoodProducts we want to count
     *   }
     * })
    **/
    count<T extends BidfoodProductCountArgs>(
      args?: Subset<T, BidfoodProductCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BidfoodProductCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a BidfoodProduct.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BidfoodProductAggregateArgs>(args: Subset<T, BidfoodProductAggregateArgs>): Prisma.PrismaPromise<GetBidfoodProductAggregateType<T>>

    /**
     * Group by BidfoodProduct.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BidfoodProductGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BidfoodProductGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BidfoodProductGroupByArgs['orderBy'] }
        : { orderBy?: BidfoodProductGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BidfoodProductGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBidfoodProductGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the BidfoodProduct model
   */
  readonly fields: BidfoodProductFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for BidfoodProduct.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BidfoodProductClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the BidfoodProduct model
   */
  interface BidfoodProductFieldRefs {
    readonly id: FieldRef<"BidfoodProduct", 'String'>
    readonly productCode: FieldRef<"BidfoodProduct", 'String'>
    readonly brand: FieldRef<"BidfoodProduct", 'String'>
    readonly description: FieldRef<"BidfoodProduct", 'String'>
    readonly packSize: FieldRef<"BidfoodProduct", 'String'>
    readonly ctnQty: FieldRef<"BidfoodProduct", 'String'>
    readonly uom: FieldRef<"BidfoodProduct", 'String'>
    readonly qty: FieldRef<"BidfoodProduct", 'Int'>
    readonly lastPricePaid: FieldRef<"BidfoodProduct", 'Float'>
    readonly totalExGST: FieldRef<"BidfoodProduct", 'Float'>
    readonly contains: FieldRef<"BidfoodProduct", 'String'>
    readonly createdAt: FieldRef<"BidfoodProduct", 'DateTime'>
    readonly updatedAt: FieldRef<"BidfoodProduct", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * BidfoodProduct findUnique
   */
  export type BidfoodProductFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * Filter, which BidfoodProduct to fetch.
     */
    where: BidfoodProductWhereUniqueInput
  }

  /**
   * BidfoodProduct findUniqueOrThrow
   */
  export type BidfoodProductFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * Filter, which BidfoodProduct to fetch.
     */
    where: BidfoodProductWhereUniqueInput
  }

  /**
   * BidfoodProduct findFirst
   */
  export type BidfoodProductFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * Filter, which BidfoodProduct to fetch.
     */
    where?: BidfoodProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BidfoodProducts to fetch.
     */
    orderBy?: BidfoodProductOrderByWithRelationInput | BidfoodProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BidfoodProducts.
     */
    cursor?: BidfoodProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BidfoodProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BidfoodProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BidfoodProducts.
     */
    distinct?: BidfoodProductScalarFieldEnum | BidfoodProductScalarFieldEnum[]
  }

  /**
   * BidfoodProduct findFirstOrThrow
   */
  export type BidfoodProductFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * Filter, which BidfoodProduct to fetch.
     */
    where?: BidfoodProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BidfoodProducts to fetch.
     */
    orderBy?: BidfoodProductOrderByWithRelationInput | BidfoodProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for BidfoodProducts.
     */
    cursor?: BidfoodProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BidfoodProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BidfoodProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of BidfoodProducts.
     */
    distinct?: BidfoodProductScalarFieldEnum | BidfoodProductScalarFieldEnum[]
  }

  /**
   * BidfoodProduct findMany
   */
  export type BidfoodProductFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * Filter, which BidfoodProducts to fetch.
     */
    where?: BidfoodProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of BidfoodProducts to fetch.
     */
    orderBy?: BidfoodProductOrderByWithRelationInput | BidfoodProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing BidfoodProducts.
     */
    cursor?: BidfoodProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` BidfoodProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` BidfoodProducts.
     */
    skip?: number
    distinct?: BidfoodProductScalarFieldEnum | BidfoodProductScalarFieldEnum[]
  }

  /**
   * BidfoodProduct create
   */
  export type BidfoodProductCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * The data needed to create a BidfoodProduct.
     */
    data: XOR<BidfoodProductCreateInput, BidfoodProductUncheckedCreateInput>
  }

  /**
   * BidfoodProduct createMany
   */
  export type BidfoodProductCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many BidfoodProducts.
     */
    data: BidfoodProductCreateManyInput | BidfoodProductCreateManyInput[]
  }

  /**
   * BidfoodProduct createManyAndReturn
   */
  export type BidfoodProductCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * The data used to create many BidfoodProducts.
     */
    data: BidfoodProductCreateManyInput | BidfoodProductCreateManyInput[]
  }

  /**
   * BidfoodProduct update
   */
  export type BidfoodProductUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * The data needed to update a BidfoodProduct.
     */
    data: XOR<BidfoodProductUpdateInput, BidfoodProductUncheckedUpdateInput>
    /**
     * Choose, which BidfoodProduct to update.
     */
    where: BidfoodProductWhereUniqueInput
  }

  /**
   * BidfoodProduct updateMany
   */
  export type BidfoodProductUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update BidfoodProducts.
     */
    data: XOR<BidfoodProductUpdateManyMutationInput, BidfoodProductUncheckedUpdateManyInput>
    /**
     * Filter which BidfoodProducts to update
     */
    where?: BidfoodProductWhereInput
    /**
     * Limit how many BidfoodProducts to update.
     */
    limit?: number
  }

  /**
   * BidfoodProduct updateManyAndReturn
   */
  export type BidfoodProductUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * The data used to update BidfoodProducts.
     */
    data: XOR<BidfoodProductUpdateManyMutationInput, BidfoodProductUncheckedUpdateManyInput>
    /**
     * Filter which BidfoodProducts to update
     */
    where?: BidfoodProductWhereInput
    /**
     * Limit how many BidfoodProducts to update.
     */
    limit?: number
  }

  /**
   * BidfoodProduct upsert
   */
  export type BidfoodProductUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * The filter to search for the BidfoodProduct to update in case it exists.
     */
    where: BidfoodProductWhereUniqueInput
    /**
     * In case the BidfoodProduct found by the `where` argument doesn't exist, create a new BidfoodProduct with this data.
     */
    create: XOR<BidfoodProductCreateInput, BidfoodProductUncheckedCreateInput>
    /**
     * In case the BidfoodProduct was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BidfoodProductUpdateInput, BidfoodProductUncheckedUpdateInput>
  }

  /**
   * BidfoodProduct delete
   */
  export type BidfoodProductDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
    /**
     * Filter which BidfoodProduct to delete.
     */
    where: BidfoodProductWhereUniqueInput
  }

  /**
   * BidfoodProduct deleteMany
   */
  export type BidfoodProductDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which BidfoodProducts to delete
     */
    where?: BidfoodProductWhereInput
    /**
     * Limit how many BidfoodProducts to delete.
     */
    limit?: number
  }

  /**
   * BidfoodProduct without action
   */
  export type BidfoodProductDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BidfoodProduct
     */
    select?: BidfoodProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the BidfoodProduct
     */
    omit?: BidfoodProductOmit<ExtArgs> | null
  }


  /**
   * Model OtherProduct
   */

  export type AggregateOtherProduct = {
    _count: OtherProductCountAggregateOutputType | null
    _avg: OtherProductAvgAggregateOutputType | null
    _sum: OtherProductSumAggregateOutputType | null
    _min: OtherProductMinAggregateOutputType | null
    _max: OtherProductMaxAggregateOutputType | null
  }

  export type OtherProductAvgAggregateOutputType = {
    cost: number | null
  }

  export type OtherProductSumAggregateOutputType = {
    cost: number | null
  }

  export type OtherProductMinAggregateOutputType = {
    id: string | null
    name: string | null
    supplier: string | null
    description: string | null
    cost: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type OtherProductMaxAggregateOutputType = {
    id: string | null
    name: string | null
    supplier: string | null
    description: string | null
    cost: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type OtherProductCountAggregateOutputType = {
    id: number
    name: number
    supplier: number
    description: number
    cost: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type OtherProductAvgAggregateInputType = {
    cost?: true
  }

  export type OtherProductSumAggregateInputType = {
    cost?: true
  }

  export type OtherProductMinAggregateInputType = {
    id?: true
    name?: true
    supplier?: true
    description?: true
    cost?: true
    createdAt?: true
    updatedAt?: true
  }

  export type OtherProductMaxAggregateInputType = {
    id?: true
    name?: true
    supplier?: true
    description?: true
    cost?: true
    createdAt?: true
    updatedAt?: true
  }

  export type OtherProductCountAggregateInputType = {
    id?: true
    name?: true
    supplier?: true
    description?: true
    cost?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type OtherProductAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which OtherProduct to aggregate.
     */
    where?: OtherProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OtherProducts to fetch.
     */
    orderBy?: OtherProductOrderByWithRelationInput | OtherProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OtherProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OtherProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OtherProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned OtherProducts
    **/
    _count?: true | OtherProductCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OtherProductAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OtherProductSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OtherProductMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OtherProductMaxAggregateInputType
  }

  export type GetOtherProductAggregateType<T extends OtherProductAggregateArgs> = {
        [P in keyof T & keyof AggregateOtherProduct]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOtherProduct[P]>
      : GetScalarType<T[P], AggregateOtherProduct[P]>
  }




  export type OtherProductGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OtherProductWhereInput
    orderBy?: OtherProductOrderByWithAggregationInput | OtherProductOrderByWithAggregationInput[]
    by: OtherProductScalarFieldEnum[] | OtherProductScalarFieldEnum
    having?: OtherProductScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OtherProductCountAggregateInputType | true
    _avg?: OtherProductAvgAggregateInputType
    _sum?: OtherProductSumAggregateInputType
    _min?: OtherProductMinAggregateInputType
    _max?: OtherProductMaxAggregateInputType
  }

  export type OtherProductGroupByOutputType = {
    id: string
    name: string
    supplier: string
    description: string
    cost: number
    createdAt: Date
    updatedAt: Date
    _count: OtherProductCountAggregateOutputType | null
    _avg: OtherProductAvgAggregateOutputType | null
    _sum: OtherProductSumAggregateOutputType | null
    _min: OtherProductMinAggregateOutputType | null
    _max: OtherProductMaxAggregateOutputType | null
  }

  type GetOtherProductGroupByPayload<T extends OtherProductGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OtherProductGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OtherProductGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OtherProductGroupByOutputType[P]>
            : GetScalarType<T[P], OtherProductGroupByOutputType[P]>
        }
      >
    >


  export type OtherProductSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    supplier?: boolean
    description?: boolean
    cost?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["otherProduct"]>

  export type OtherProductSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    supplier?: boolean
    description?: boolean
    cost?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["otherProduct"]>

  export type OtherProductSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    supplier?: boolean
    description?: boolean
    cost?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["otherProduct"]>

  export type OtherProductSelectScalar = {
    id?: boolean
    name?: boolean
    supplier?: boolean
    description?: boolean
    cost?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type OtherProductOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "supplier" | "description" | "cost" | "createdAt" | "updatedAt", ExtArgs["result"]["otherProduct"]>

  export type $OtherProductPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "OtherProduct"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      supplier: string
      description: string
      cost: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["otherProduct"]>
    composites: {}
  }

  type OtherProductGetPayload<S extends boolean | null | undefined | OtherProductDefaultArgs> = $Result.GetResult<Prisma.$OtherProductPayload, S>

  type OtherProductCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<OtherProductFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: OtherProductCountAggregateInputType | true
    }

  export interface OtherProductDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['OtherProduct'], meta: { name: 'OtherProduct' } }
    /**
     * Find zero or one OtherProduct that matches the filter.
     * @param {OtherProductFindUniqueArgs} args - Arguments to find a OtherProduct
     * @example
     * // Get one OtherProduct
     * const otherProduct = await prisma.otherProduct.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OtherProductFindUniqueArgs>(args: SelectSubset<T, OtherProductFindUniqueArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one OtherProduct that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OtherProductFindUniqueOrThrowArgs} args - Arguments to find a OtherProduct
     * @example
     * // Get one OtherProduct
     * const otherProduct = await prisma.otherProduct.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OtherProductFindUniqueOrThrowArgs>(args: SelectSubset<T, OtherProductFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first OtherProduct that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductFindFirstArgs} args - Arguments to find a OtherProduct
     * @example
     * // Get one OtherProduct
     * const otherProduct = await prisma.otherProduct.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OtherProductFindFirstArgs>(args?: SelectSubset<T, OtherProductFindFirstArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first OtherProduct that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductFindFirstOrThrowArgs} args - Arguments to find a OtherProduct
     * @example
     * // Get one OtherProduct
     * const otherProduct = await prisma.otherProduct.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OtherProductFindFirstOrThrowArgs>(args?: SelectSubset<T, OtherProductFindFirstOrThrowArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more OtherProducts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OtherProducts
     * const otherProducts = await prisma.otherProduct.findMany()
     * 
     * // Get first 10 OtherProducts
     * const otherProducts = await prisma.otherProduct.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const otherProductWithIdOnly = await prisma.otherProduct.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OtherProductFindManyArgs>(args?: SelectSubset<T, OtherProductFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a OtherProduct.
     * @param {OtherProductCreateArgs} args - Arguments to create a OtherProduct.
     * @example
     * // Create one OtherProduct
     * const OtherProduct = await prisma.otherProduct.create({
     *   data: {
     *     // ... data to create a OtherProduct
     *   }
     * })
     * 
     */
    create<T extends OtherProductCreateArgs>(args: SelectSubset<T, OtherProductCreateArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many OtherProducts.
     * @param {OtherProductCreateManyArgs} args - Arguments to create many OtherProducts.
     * @example
     * // Create many OtherProducts
     * const otherProduct = await prisma.otherProduct.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OtherProductCreateManyArgs>(args?: SelectSubset<T, OtherProductCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many OtherProducts and returns the data saved in the database.
     * @param {OtherProductCreateManyAndReturnArgs} args - Arguments to create many OtherProducts.
     * @example
     * // Create many OtherProducts
     * const otherProduct = await prisma.otherProduct.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many OtherProducts and only return the `id`
     * const otherProductWithIdOnly = await prisma.otherProduct.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OtherProductCreateManyAndReturnArgs>(args?: SelectSubset<T, OtherProductCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a OtherProduct.
     * @param {OtherProductDeleteArgs} args - Arguments to delete one OtherProduct.
     * @example
     * // Delete one OtherProduct
     * const OtherProduct = await prisma.otherProduct.delete({
     *   where: {
     *     // ... filter to delete one OtherProduct
     *   }
     * })
     * 
     */
    delete<T extends OtherProductDeleteArgs>(args: SelectSubset<T, OtherProductDeleteArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one OtherProduct.
     * @param {OtherProductUpdateArgs} args - Arguments to update one OtherProduct.
     * @example
     * // Update one OtherProduct
     * const otherProduct = await prisma.otherProduct.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OtherProductUpdateArgs>(args: SelectSubset<T, OtherProductUpdateArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more OtherProducts.
     * @param {OtherProductDeleteManyArgs} args - Arguments to filter OtherProducts to delete.
     * @example
     * // Delete a few OtherProducts
     * const { count } = await prisma.otherProduct.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OtherProductDeleteManyArgs>(args?: SelectSubset<T, OtherProductDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OtherProducts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OtherProducts
     * const otherProduct = await prisma.otherProduct.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OtherProductUpdateManyArgs>(args: SelectSubset<T, OtherProductUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OtherProducts and returns the data updated in the database.
     * @param {OtherProductUpdateManyAndReturnArgs} args - Arguments to update many OtherProducts.
     * @example
     * // Update many OtherProducts
     * const otherProduct = await prisma.otherProduct.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more OtherProducts and only return the `id`
     * const otherProductWithIdOnly = await prisma.otherProduct.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends OtherProductUpdateManyAndReturnArgs>(args: SelectSubset<T, OtherProductUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one OtherProduct.
     * @param {OtherProductUpsertArgs} args - Arguments to update or create a OtherProduct.
     * @example
     * // Update or create a OtherProduct
     * const otherProduct = await prisma.otherProduct.upsert({
     *   create: {
     *     // ... data to create a OtherProduct
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OtherProduct we want to update
     *   }
     * })
     */
    upsert<T extends OtherProductUpsertArgs>(args: SelectSubset<T, OtherProductUpsertArgs<ExtArgs>>): Prisma__OtherProductClient<$Result.GetResult<Prisma.$OtherProductPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of OtherProducts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductCountArgs} args - Arguments to filter OtherProducts to count.
     * @example
     * // Count the number of OtherProducts
     * const count = await prisma.otherProduct.count({
     *   where: {
     *     // ... the filter for the OtherProducts we want to count
     *   }
     * })
    **/
    count<T extends OtherProductCountArgs>(
      args?: Subset<T, OtherProductCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OtherProductCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a OtherProduct.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OtherProductAggregateArgs>(args: Subset<T, OtherProductAggregateArgs>): Prisma.PrismaPromise<GetOtherProductAggregateType<T>>

    /**
     * Group by OtherProduct.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtherProductGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OtherProductGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OtherProductGroupByArgs['orderBy'] }
        : { orderBy?: OtherProductGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OtherProductGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOtherProductGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the OtherProduct model
   */
  readonly fields: OtherProductFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for OtherProduct.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OtherProductClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the OtherProduct model
   */
  interface OtherProductFieldRefs {
    readonly id: FieldRef<"OtherProduct", 'String'>
    readonly name: FieldRef<"OtherProduct", 'String'>
    readonly supplier: FieldRef<"OtherProduct", 'String'>
    readonly description: FieldRef<"OtherProduct", 'String'>
    readonly cost: FieldRef<"OtherProduct", 'Float'>
    readonly createdAt: FieldRef<"OtherProduct", 'DateTime'>
    readonly updatedAt: FieldRef<"OtherProduct", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * OtherProduct findUnique
   */
  export type OtherProductFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * Filter, which OtherProduct to fetch.
     */
    where: OtherProductWhereUniqueInput
  }

  /**
   * OtherProduct findUniqueOrThrow
   */
  export type OtherProductFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * Filter, which OtherProduct to fetch.
     */
    where: OtherProductWhereUniqueInput
  }

  /**
   * OtherProduct findFirst
   */
  export type OtherProductFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * Filter, which OtherProduct to fetch.
     */
    where?: OtherProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OtherProducts to fetch.
     */
    orderBy?: OtherProductOrderByWithRelationInput | OtherProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OtherProducts.
     */
    cursor?: OtherProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OtherProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OtherProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OtherProducts.
     */
    distinct?: OtherProductScalarFieldEnum | OtherProductScalarFieldEnum[]
  }

  /**
   * OtherProduct findFirstOrThrow
   */
  export type OtherProductFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * Filter, which OtherProduct to fetch.
     */
    where?: OtherProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OtherProducts to fetch.
     */
    orderBy?: OtherProductOrderByWithRelationInput | OtherProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OtherProducts.
     */
    cursor?: OtherProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OtherProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OtherProducts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OtherProducts.
     */
    distinct?: OtherProductScalarFieldEnum | OtherProductScalarFieldEnum[]
  }

  /**
   * OtherProduct findMany
   */
  export type OtherProductFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * Filter, which OtherProducts to fetch.
     */
    where?: OtherProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OtherProducts to fetch.
     */
    orderBy?: OtherProductOrderByWithRelationInput | OtherProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing OtherProducts.
     */
    cursor?: OtherProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OtherProducts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OtherProducts.
     */
    skip?: number
    distinct?: OtherProductScalarFieldEnum | OtherProductScalarFieldEnum[]
  }

  /**
   * OtherProduct create
   */
  export type OtherProductCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * The data needed to create a OtherProduct.
     */
    data: XOR<OtherProductCreateInput, OtherProductUncheckedCreateInput>
  }

  /**
   * OtherProduct createMany
   */
  export type OtherProductCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many OtherProducts.
     */
    data: OtherProductCreateManyInput | OtherProductCreateManyInput[]
  }

  /**
   * OtherProduct createManyAndReturn
   */
  export type OtherProductCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * The data used to create many OtherProducts.
     */
    data: OtherProductCreateManyInput | OtherProductCreateManyInput[]
  }

  /**
   * OtherProduct update
   */
  export type OtherProductUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * The data needed to update a OtherProduct.
     */
    data: XOR<OtherProductUpdateInput, OtherProductUncheckedUpdateInput>
    /**
     * Choose, which OtherProduct to update.
     */
    where: OtherProductWhereUniqueInput
  }

  /**
   * OtherProduct updateMany
   */
  export type OtherProductUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update OtherProducts.
     */
    data: XOR<OtherProductUpdateManyMutationInput, OtherProductUncheckedUpdateManyInput>
    /**
     * Filter which OtherProducts to update
     */
    where?: OtherProductWhereInput
    /**
     * Limit how many OtherProducts to update.
     */
    limit?: number
  }

  /**
   * OtherProduct updateManyAndReturn
   */
  export type OtherProductUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * The data used to update OtherProducts.
     */
    data: XOR<OtherProductUpdateManyMutationInput, OtherProductUncheckedUpdateManyInput>
    /**
     * Filter which OtherProducts to update
     */
    where?: OtherProductWhereInput
    /**
     * Limit how many OtherProducts to update.
     */
    limit?: number
  }

  /**
   * OtherProduct upsert
   */
  export type OtherProductUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * The filter to search for the OtherProduct to update in case it exists.
     */
    where: OtherProductWhereUniqueInput
    /**
     * In case the OtherProduct found by the `where` argument doesn't exist, create a new OtherProduct with this data.
     */
    create: XOR<OtherProductCreateInput, OtherProductUncheckedCreateInput>
    /**
     * In case the OtherProduct was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OtherProductUpdateInput, OtherProductUncheckedUpdateInput>
  }

  /**
   * OtherProduct delete
   */
  export type OtherProductDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
    /**
     * Filter which OtherProduct to delete.
     */
    where: OtherProductWhereUniqueInput
  }

  /**
   * OtherProduct deleteMany
   */
  export type OtherProductDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which OtherProducts to delete
     */
    where?: OtherProductWhereInput
    /**
     * Limit how many OtherProducts to delete.
     */
    limit?: number
  }

  /**
   * OtherProduct without action
   */
  export type OtherProductDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OtherProduct
     */
    select?: OtherProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OtherProduct
     */
    omit?: OtherProductOmit<ExtArgs> | null
  }


  /**
   * Model Supplier
   */

  export type AggregateSupplier = {
    _count: SupplierCountAggregateOutputType | null
    _min: SupplierMinAggregateOutputType | null
    _max: SupplierMaxAggregateOutputType | null
  }

  export type SupplierMinAggregateOutputType = {
    id: string | null
    name: string | null
    contactName: string | null
    contactNumber: string | null
    contactEmail: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SupplierMaxAggregateOutputType = {
    id: string | null
    name: string | null
    contactName: string | null
    contactNumber: string | null
    contactEmail: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SupplierCountAggregateOutputType = {
    id: number
    name: number
    contactName: number
    contactNumber: number
    contactEmail: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SupplierMinAggregateInputType = {
    id?: true
    name?: true
    contactName?: true
    contactNumber?: true
    contactEmail?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SupplierMaxAggregateInputType = {
    id?: true
    name?: true
    contactName?: true
    contactNumber?: true
    contactEmail?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SupplierCountAggregateInputType = {
    id?: true
    name?: true
    contactName?: true
    contactNumber?: true
    contactEmail?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SupplierAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Supplier to aggregate.
     */
    where?: SupplierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Suppliers to fetch.
     */
    orderBy?: SupplierOrderByWithRelationInput | SupplierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SupplierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Suppliers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Suppliers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Suppliers
    **/
    _count?: true | SupplierCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SupplierMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SupplierMaxAggregateInputType
  }

  export type GetSupplierAggregateType<T extends SupplierAggregateArgs> = {
        [P in keyof T & keyof AggregateSupplier]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSupplier[P]>
      : GetScalarType<T[P], AggregateSupplier[P]>
  }




  export type SupplierGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SupplierWhereInput
    orderBy?: SupplierOrderByWithAggregationInput | SupplierOrderByWithAggregationInput[]
    by: SupplierScalarFieldEnum[] | SupplierScalarFieldEnum
    having?: SupplierScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SupplierCountAggregateInputType | true
    _min?: SupplierMinAggregateInputType
    _max?: SupplierMaxAggregateInputType
  }

  export type SupplierGroupByOutputType = {
    id: string
    name: string
    contactName: string | null
    contactNumber: string | null
    contactEmail: string | null
    createdAt: Date
    updatedAt: Date
    _count: SupplierCountAggregateOutputType | null
    _min: SupplierMinAggregateOutputType | null
    _max: SupplierMaxAggregateOutputType | null
  }

  type GetSupplierGroupByPayload<T extends SupplierGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SupplierGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SupplierGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SupplierGroupByOutputType[P]>
            : GetScalarType<T[P], SupplierGroupByOutputType[P]>
        }
      >
    >


  export type SupplierSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    contactName?: boolean
    contactNumber?: boolean
    contactEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["supplier"]>

  export type SupplierSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    contactName?: boolean
    contactNumber?: boolean
    contactEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["supplier"]>

  export type SupplierSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    contactName?: boolean
    contactNumber?: boolean
    contactEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["supplier"]>

  export type SupplierSelectScalar = {
    id?: boolean
    name?: boolean
    contactName?: boolean
    contactNumber?: boolean
    contactEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SupplierOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "contactName" | "contactNumber" | "contactEmail" | "createdAt" | "updatedAt", ExtArgs["result"]["supplier"]>

  export type $SupplierPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Supplier"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      contactName: string | null
      contactNumber: string | null
      contactEmail: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["supplier"]>
    composites: {}
  }

  type SupplierGetPayload<S extends boolean | null | undefined | SupplierDefaultArgs> = $Result.GetResult<Prisma.$SupplierPayload, S>

  type SupplierCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SupplierFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SupplierCountAggregateInputType | true
    }

  export interface SupplierDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Supplier'], meta: { name: 'Supplier' } }
    /**
     * Find zero or one Supplier that matches the filter.
     * @param {SupplierFindUniqueArgs} args - Arguments to find a Supplier
     * @example
     * // Get one Supplier
     * const supplier = await prisma.supplier.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SupplierFindUniqueArgs>(args: SelectSubset<T, SupplierFindUniqueArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Supplier that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SupplierFindUniqueOrThrowArgs} args - Arguments to find a Supplier
     * @example
     * // Get one Supplier
     * const supplier = await prisma.supplier.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SupplierFindUniqueOrThrowArgs>(args: SelectSubset<T, SupplierFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Supplier that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierFindFirstArgs} args - Arguments to find a Supplier
     * @example
     * // Get one Supplier
     * const supplier = await prisma.supplier.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SupplierFindFirstArgs>(args?: SelectSubset<T, SupplierFindFirstArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Supplier that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierFindFirstOrThrowArgs} args - Arguments to find a Supplier
     * @example
     * // Get one Supplier
     * const supplier = await prisma.supplier.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SupplierFindFirstOrThrowArgs>(args?: SelectSubset<T, SupplierFindFirstOrThrowArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Suppliers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Suppliers
     * const suppliers = await prisma.supplier.findMany()
     * 
     * // Get first 10 Suppliers
     * const suppliers = await prisma.supplier.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const supplierWithIdOnly = await prisma.supplier.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SupplierFindManyArgs>(args?: SelectSubset<T, SupplierFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Supplier.
     * @param {SupplierCreateArgs} args - Arguments to create a Supplier.
     * @example
     * // Create one Supplier
     * const Supplier = await prisma.supplier.create({
     *   data: {
     *     // ... data to create a Supplier
     *   }
     * })
     * 
     */
    create<T extends SupplierCreateArgs>(args: SelectSubset<T, SupplierCreateArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Suppliers.
     * @param {SupplierCreateManyArgs} args - Arguments to create many Suppliers.
     * @example
     * // Create many Suppliers
     * const supplier = await prisma.supplier.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SupplierCreateManyArgs>(args?: SelectSubset<T, SupplierCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Suppliers and returns the data saved in the database.
     * @param {SupplierCreateManyAndReturnArgs} args - Arguments to create many Suppliers.
     * @example
     * // Create many Suppliers
     * const supplier = await prisma.supplier.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Suppliers and only return the `id`
     * const supplierWithIdOnly = await prisma.supplier.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SupplierCreateManyAndReturnArgs>(args?: SelectSubset<T, SupplierCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Supplier.
     * @param {SupplierDeleteArgs} args - Arguments to delete one Supplier.
     * @example
     * // Delete one Supplier
     * const Supplier = await prisma.supplier.delete({
     *   where: {
     *     // ... filter to delete one Supplier
     *   }
     * })
     * 
     */
    delete<T extends SupplierDeleteArgs>(args: SelectSubset<T, SupplierDeleteArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Supplier.
     * @param {SupplierUpdateArgs} args - Arguments to update one Supplier.
     * @example
     * // Update one Supplier
     * const supplier = await prisma.supplier.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SupplierUpdateArgs>(args: SelectSubset<T, SupplierUpdateArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Suppliers.
     * @param {SupplierDeleteManyArgs} args - Arguments to filter Suppliers to delete.
     * @example
     * // Delete a few Suppliers
     * const { count } = await prisma.supplier.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SupplierDeleteManyArgs>(args?: SelectSubset<T, SupplierDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Suppliers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Suppliers
     * const supplier = await prisma.supplier.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SupplierUpdateManyArgs>(args: SelectSubset<T, SupplierUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Suppliers and returns the data updated in the database.
     * @param {SupplierUpdateManyAndReturnArgs} args - Arguments to update many Suppliers.
     * @example
     * // Update many Suppliers
     * const supplier = await prisma.supplier.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Suppliers and only return the `id`
     * const supplierWithIdOnly = await prisma.supplier.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SupplierUpdateManyAndReturnArgs>(args: SelectSubset<T, SupplierUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Supplier.
     * @param {SupplierUpsertArgs} args - Arguments to update or create a Supplier.
     * @example
     * // Update or create a Supplier
     * const supplier = await prisma.supplier.upsert({
     *   create: {
     *     // ... data to create a Supplier
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Supplier we want to update
     *   }
     * })
     */
    upsert<T extends SupplierUpsertArgs>(args: SelectSubset<T, SupplierUpsertArgs<ExtArgs>>): Prisma__SupplierClient<$Result.GetResult<Prisma.$SupplierPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Suppliers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierCountArgs} args - Arguments to filter Suppliers to count.
     * @example
     * // Count the number of Suppliers
     * const count = await prisma.supplier.count({
     *   where: {
     *     // ... the filter for the Suppliers we want to count
     *   }
     * })
    **/
    count<T extends SupplierCountArgs>(
      args?: Subset<T, SupplierCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SupplierCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Supplier.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SupplierAggregateArgs>(args: Subset<T, SupplierAggregateArgs>): Prisma.PrismaPromise<GetSupplierAggregateType<T>>

    /**
     * Group by Supplier.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SupplierGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SupplierGroupByArgs['orderBy'] }
        : { orderBy?: SupplierGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SupplierGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSupplierGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Supplier model
   */
  readonly fields: SupplierFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Supplier.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SupplierClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Supplier model
   */
  interface SupplierFieldRefs {
    readonly id: FieldRef<"Supplier", 'String'>
    readonly name: FieldRef<"Supplier", 'String'>
    readonly contactName: FieldRef<"Supplier", 'String'>
    readonly contactNumber: FieldRef<"Supplier", 'String'>
    readonly contactEmail: FieldRef<"Supplier", 'String'>
    readonly createdAt: FieldRef<"Supplier", 'DateTime'>
    readonly updatedAt: FieldRef<"Supplier", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Supplier findUnique
   */
  export type SupplierFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * Filter, which Supplier to fetch.
     */
    where: SupplierWhereUniqueInput
  }

  /**
   * Supplier findUniqueOrThrow
   */
  export type SupplierFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * Filter, which Supplier to fetch.
     */
    where: SupplierWhereUniqueInput
  }

  /**
   * Supplier findFirst
   */
  export type SupplierFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * Filter, which Supplier to fetch.
     */
    where?: SupplierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Suppliers to fetch.
     */
    orderBy?: SupplierOrderByWithRelationInput | SupplierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Suppliers.
     */
    cursor?: SupplierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Suppliers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Suppliers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Suppliers.
     */
    distinct?: SupplierScalarFieldEnum | SupplierScalarFieldEnum[]
  }

  /**
   * Supplier findFirstOrThrow
   */
  export type SupplierFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * Filter, which Supplier to fetch.
     */
    where?: SupplierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Suppliers to fetch.
     */
    orderBy?: SupplierOrderByWithRelationInput | SupplierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Suppliers.
     */
    cursor?: SupplierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Suppliers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Suppliers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Suppliers.
     */
    distinct?: SupplierScalarFieldEnum | SupplierScalarFieldEnum[]
  }

  /**
   * Supplier findMany
   */
  export type SupplierFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * Filter, which Suppliers to fetch.
     */
    where?: SupplierWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Suppliers to fetch.
     */
    orderBy?: SupplierOrderByWithRelationInput | SupplierOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Suppliers.
     */
    cursor?: SupplierWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Suppliers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Suppliers.
     */
    skip?: number
    distinct?: SupplierScalarFieldEnum | SupplierScalarFieldEnum[]
  }

  /**
   * Supplier create
   */
  export type SupplierCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * The data needed to create a Supplier.
     */
    data: XOR<SupplierCreateInput, SupplierUncheckedCreateInput>
  }

  /**
   * Supplier createMany
   */
  export type SupplierCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Suppliers.
     */
    data: SupplierCreateManyInput | SupplierCreateManyInput[]
  }

  /**
   * Supplier createManyAndReturn
   */
  export type SupplierCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * The data used to create many Suppliers.
     */
    data: SupplierCreateManyInput | SupplierCreateManyInput[]
  }

  /**
   * Supplier update
   */
  export type SupplierUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * The data needed to update a Supplier.
     */
    data: XOR<SupplierUpdateInput, SupplierUncheckedUpdateInput>
    /**
     * Choose, which Supplier to update.
     */
    where: SupplierWhereUniqueInput
  }

  /**
   * Supplier updateMany
   */
  export type SupplierUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Suppliers.
     */
    data: XOR<SupplierUpdateManyMutationInput, SupplierUncheckedUpdateManyInput>
    /**
     * Filter which Suppliers to update
     */
    where?: SupplierWhereInput
    /**
     * Limit how many Suppliers to update.
     */
    limit?: number
  }

  /**
   * Supplier updateManyAndReturn
   */
  export type SupplierUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * The data used to update Suppliers.
     */
    data: XOR<SupplierUpdateManyMutationInput, SupplierUncheckedUpdateManyInput>
    /**
     * Filter which Suppliers to update
     */
    where?: SupplierWhereInput
    /**
     * Limit how many Suppliers to update.
     */
    limit?: number
  }

  /**
   * Supplier upsert
   */
  export type SupplierUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * The filter to search for the Supplier to update in case it exists.
     */
    where: SupplierWhereUniqueInput
    /**
     * In case the Supplier found by the `where` argument doesn't exist, create a new Supplier with this data.
     */
    create: XOR<SupplierCreateInput, SupplierUncheckedCreateInput>
    /**
     * In case the Supplier was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SupplierUpdateInput, SupplierUncheckedUpdateInput>
  }

  /**
   * Supplier delete
   */
  export type SupplierDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
    /**
     * Filter which Supplier to delete.
     */
    where: SupplierWhereUniqueInput
  }

  /**
   * Supplier deleteMany
   */
  export type SupplierDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Suppliers to delete
     */
    where?: SupplierWhereInput
    /**
     * Limit how many Suppliers to delete.
     */
    limit?: number
  }

  /**
   * Supplier without action
   */
  export type SupplierDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Supplier
     */
    select?: SupplierSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Supplier
     */
    omit?: SupplierOmit<ExtArgs> | null
  }


  /**
   * Model Component
   */

  export type AggregateComponent = {
    _count: ComponentCountAggregateOutputType | null
    _avg: ComponentAvgAggregateOutputType | null
    _sum: ComponentSumAggregateOutputType | null
    _min: ComponentMinAggregateOutputType | null
    _max: ComponentMaxAggregateOutputType | null
  }

  export type ComponentAvgAggregateOutputType = {
    totalCost: number | null
  }

  export type ComponentSumAggregateOutputType = {
    totalCost: number | null
  }

  export type ComponentMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    totalCost: number | null
    hasGluten: boolean | null
    hasDairy: boolean | null
    hasSoy: boolean | null
    hasOnionGarlic: boolean | null
    hasSesame: boolean | null
    hasNuts: boolean | null
    hasEgg: boolean | null
    isVegetarian: boolean | null
    isVegan: boolean | null
    isHalal: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ComponentMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    totalCost: number | null
    hasGluten: boolean | null
    hasDairy: boolean | null
    hasSoy: boolean | null
    hasOnionGarlic: boolean | null
    hasSesame: boolean | null
    hasNuts: boolean | null
    hasEgg: boolean | null
    isVegetarian: boolean | null
    isVegan: boolean | null
    isHalal: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ComponentCountAggregateOutputType = {
    id: number
    name: number
    description: number
    ingredients: number
    totalCost: number
    hasGluten: number
    hasDairy: number
    hasSoy: number
    hasOnionGarlic: number
    hasSesame: number
    hasNuts: number
    hasEgg: number
    isVegetarian: number
    isVegan: number
    isHalal: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ComponentAvgAggregateInputType = {
    totalCost?: true
  }

  export type ComponentSumAggregateInputType = {
    totalCost?: true
  }

  export type ComponentMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    totalCost?: true
    hasGluten?: true
    hasDairy?: true
    hasSoy?: true
    hasOnionGarlic?: true
    hasSesame?: true
    hasNuts?: true
    hasEgg?: true
    isVegetarian?: true
    isVegan?: true
    isHalal?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ComponentMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    totalCost?: true
    hasGluten?: true
    hasDairy?: true
    hasSoy?: true
    hasOnionGarlic?: true
    hasSesame?: true
    hasNuts?: true
    hasEgg?: true
    isVegetarian?: true
    isVegan?: true
    isHalal?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ComponentCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    ingredients?: true
    totalCost?: true
    hasGluten?: true
    hasDairy?: true
    hasSoy?: true
    hasOnionGarlic?: true
    hasSesame?: true
    hasNuts?: true
    hasEgg?: true
    isVegetarian?: true
    isVegan?: true
    isHalal?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ComponentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Component to aggregate.
     */
    where?: ComponentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Components to fetch.
     */
    orderBy?: ComponentOrderByWithRelationInput | ComponentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ComponentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Components from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Components.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Components
    **/
    _count?: true | ComponentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ComponentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ComponentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ComponentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ComponentMaxAggregateInputType
  }

  export type GetComponentAggregateType<T extends ComponentAggregateArgs> = {
        [P in keyof T & keyof AggregateComponent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateComponent[P]>
      : GetScalarType<T[P], AggregateComponent[P]>
  }




  export type ComponentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ComponentWhereInput
    orderBy?: ComponentOrderByWithAggregationInput | ComponentOrderByWithAggregationInput[]
    by: ComponentScalarFieldEnum[] | ComponentScalarFieldEnum
    having?: ComponentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ComponentCountAggregateInputType | true
    _avg?: ComponentAvgAggregateInputType
    _sum?: ComponentSumAggregateInputType
    _min?: ComponentMinAggregateInputType
    _max?: ComponentMaxAggregateInputType
  }

  export type ComponentGroupByOutputType = {
    id: string
    name: string
    description: string
    ingredients: JsonValue
    totalCost: number
    hasGluten: boolean
    hasDairy: boolean
    hasSoy: boolean
    hasOnionGarlic: boolean
    hasSesame: boolean
    hasNuts: boolean
    hasEgg: boolean
    isVegetarian: boolean
    isVegan: boolean
    isHalal: boolean
    createdAt: Date
    updatedAt: Date
    _count: ComponentCountAggregateOutputType | null
    _avg: ComponentAvgAggregateOutputType | null
    _sum: ComponentSumAggregateOutputType | null
    _min: ComponentMinAggregateOutputType | null
    _max: ComponentMaxAggregateOutputType | null
  }

  type GetComponentGroupByPayload<T extends ComponentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ComponentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ComponentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ComponentGroupByOutputType[P]>
            : GetScalarType<T[P], ComponentGroupByOutputType[P]>
        }
      >
    >


  export type ComponentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    ingredients?: boolean
    totalCost?: boolean
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["component"]>

  export type ComponentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    ingredients?: boolean
    totalCost?: boolean
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["component"]>

  export type ComponentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    ingredients?: boolean
    totalCost?: boolean
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["component"]>

  export type ComponentSelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    ingredients?: boolean
    totalCost?: boolean
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ComponentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "description" | "ingredients" | "totalCost" | "hasGluten" | "hasDairy" | "hasSoy" | "hasOnionGarlic" | "hasSesame" | "hasNuts" | "hasEgg" | "isVegetarian" | "isVegan" | "isHalal" | "createdAt" | "updatedAt", ExtArgs["result"]["component"]>

  export type $ComponentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Component"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      description: string
      ingredients: Prisma.JsonValue
      totalCost: number
      hasGluten: boolean
      hasDairy: boolean
      hasSoy: boolean
      hasOnionGarlic: boolean
      hasSesame: boolean
      hasNuts: boolean
      hasEgg: boolean
      isVegetarian: boolean
      isVegan: boolean
      isHalal: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["component"]>
    composites: {}
  }

  type ComponentGetPayload<S extends boolean | null | undefined | ComponentDefaultArgs> = $Result.GetResult<Prisma.$ComponentPayload, S>

  type ComponentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ComponentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ComponentCountAggregateInputType | true
    }

  export interface ComponentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Component'], meta: { name: 'Component' } }
    /**
     * Find zero or one Component that matches the filter.
     * @param {ComponentFindUniqueArgs} args - Arguments to find a Component
     * @example
     * // Get one Component
     * const component = await prisma.component.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ComponentFindUniqueArgs>(args: SelectSubset<T, ComponentFindUniqueArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Component that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ComponentFindUniqueOrThrowArgs} args - Arguments to find a Component
     * @example
     * // Get one Component
     * const component = await prisma.component.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ComponentFindUniqueOrThrowArgs>(args: SelectSubset<T, ComponentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Component that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentFindFirstArgs} args - Arguments to find a Component
     * @example
     * // Get one Component
     * const component = await prisma.component.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ComponentFindFirstArgs>(args?: SelectSubset<T, ComponentFindFirstArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Component that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentFindFirstOrThrowArgs} args - Arguments to find a Component
     * @example
     * // Get one Component
     * const component = await prisma.component.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ComponentFindFirstOrThrowArgs>(args?: SelectSubset<T, ComponentFindFirstOrThrowArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Components that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Components
     * const components = await prisma.component.findMany()
     * 
     * // Get first 10 Components
     * const components = await prisma.component.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const componentWithIdOnly = await prisma.component.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ComponentFindManyArgs>(args?: SelectSubset<T, ComponentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Component.
     * @param {ComponentCreateArgs} args - Arguments to create a Component.
     * @example
     * // Create one Component
     * const Component = await prisma.component.create({
     *   data: {
     *     // ... data to create a Component
     *   }
     * })
     * 
     */
    create<T extends ComponentCreateArgs>(args: SelectSubset<T, ComponentCreateArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Components.
     * @param {ComponentCreateManyArgs} args - Arguments to create many Components.
     * @example
     * // Create many Components
     * const component = await prisma.component.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ComponentCreateManyArgs>(args?: SelectSubset<T, ComponentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Components and returns the data saved in the database.
     * @param {ComponentCreateManyAndReturnArgs} args - Arguments to create many Components.
     * @example
     * // Create many Components
     * const component = await prisma.component.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Components and only return the `id`
     * const componentWithIdOnly = await prisma.component.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ComponentCreateManyAndReturnArgs>(args?: SelectSubset<T, ComponentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Component.
     * @param {ComponentDeleteArgs} args - Arguments to delete one Component.
     * @example
     * // Delete one Component
     * const Component = await prisma.component.delete({
     *   where: {
     *     // ... filter to delete one Component
     *   }
     * })
     * 
     */
    delete<T extends ComponentDeleteArgs>(args: SelectSubset<T, ComponentDeleteArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Component.
     * @param {ComponentUpdateArgs} args - Arguments to update one Component.
     * @example
     * // Update one Component
     * const component = await prisma.component.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ComponentUpdateArgs>(args: SelectSubset<T, ComponentUpdateArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Components.
     * @param {ComponentDeleteManyArgs} args - Arguments to filter Components to delete.
     * @example
     * // Delete a few Components
     * const { count } = await prisma.component.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ComponentDeleteManyArgs>(args?: SelectSubset<T, ComponentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Components.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Components
     * const component = await prisma.component.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ComponentUpdateManyArgs>(args: SelectSubset<T, ComponentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Components and returns the data updated in the database.
     * @param {ComponentUpdateManyAndReturnArgs} args - Arguments to update many Components.
     * @example
     * // Update many Components
     * const component = await prisma.component.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Components and only return the `id`
     * const componentWithIdOnly = await prisma.component.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ComponentUpdateManyAndReturnArgs>(args: SelectSubset<T, ComponentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Component.
     * @param {ComponentUpsertArgs} args - Arguments to update or create a Component.
     * @example
     * // Update or create a Component
     * const component = await prisma.component.upsert({
     *   create: {
     *     // ... data to create a Component
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Component we want to update
     *   }
     * })
     */
    upsert<T extends ComponentUpsertArgs>(args: SelectSubset<T, ComponentUpsertArgs<ExtArgs>>): Prisma__ComponentClient<$Result.GetResult<Prisma.$ComponentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Components.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentCountArgs} args - Arguments to filter Components to count.
     * @example
     * // Count the number of Components
     * const count = await prisma.component.count({
     *   where: {
     *     // ... the filter for the Components we want to count
     *   }
     * })
    **/
    count<T extends ComponentCountArgs>(
      args?: Subset<T, ComponentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ComponentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Component.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ComponentAggregateArgs>(args: Subset<T, ComponentAggregateArgs>): Prisma.PrismaPromise<GetComponentAggregateType<T>>

    /**
     * Group by Component.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ComponentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ComponentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ComponentGroupByArgs['orderBy'] }
        : { orderBy?: ComponentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ComponentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetComponentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Component model
   */
  readonly fields: ComponentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Component.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ComponentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Component model
   */
  interface ComponentFieldRefs {
    readonly id: FieldRef<"Component", 'String'>
    readonly name: FieldRef<"Component", 'String'>
    readonly description: FieldRef<"Component", 'String'>
    readonly ingredients: FieldRef<"Component", 'Json'>
    readonly totalCost: FieldRef<"Component", 'Float'>
    readonly hasGluten: FieldRef<"Component", 'Boolean'>
    readonly hasDairy: FieldRef<"Component", 'Boolean'>
    readonly hasSoy: FieldRef<"Component", 'Boolean'>
    readonly hasOnionGarlic: FieldRef<"Component", 'Boolean'>
    readonly hasSesame: FieldRef<"Component", 'Boolean'>
    readonly hasNuts: FieldRef<"Component", 'Boolean'>
    readonly hasEgg: FieldRef<"Component", 'Boolean'>
    readonly isVegetarian: FieldRef<"Component", 'Boolean'>
    readonly isVegan: FieldRef<"Component", 'Boolean'>
    readonly isHalal: FieldRef<"Component", 'Boolean'>
    readonly createdAt: FieldRef<"Component", 'DateTime'>
    readonly updatedAt: FieldRef<"Component", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Component findUnique
   */
  export type ComponentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * Filter, which Component to fetch.
     */
    where: ComponentWhereUniqueInput
  }

  /**
   * Component findUniqueOrThrow
   */
  export type ComponentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * Filter, which Component to fetch.
     */
    where: ComponentWhereUniqueInput
  }

  /**
   * Component findFirst
   */
  export type ComponentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * Filter, which Component to fetch.
     */
    where?: ComponentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Components to fetch.
     */
    orderBy?: ComponentOrderByWithRelationInput | ComponentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Components.
     */
    cursor?: ComponentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Components from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Components.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Components.
     */
    distinct?: ComponentScalarFieldEnum | ComponentScalarFieldEnum[]
  }

  /**
   * Component findFirstOrThrow
   */
  export type ComponentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * Filter, which Component to fetch.
     */
    where?: ComponentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Components to fetch.
     */
    orderBy?: ComponentOrderByWithRelationInput | ComponentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Components.
     */
    cursor?: ComponentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Components from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Components.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Components.
     */
    distinct?: ComponentScalarFieldEnum | ComponentScalarFieldEnum[]
  }

  /**
   * Component findMany
   */
  export type ComponentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * Filter, which Components to fetch.
     */
    where?: ComponentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Components to fetch.
     */
    orderBy?: ComponentOrderByWithRelationInput | ComponentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Components.
     */
    cursor?: ComponentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Components from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Components.
     */
    skip?: number
    distinct?: ComponentScalarFieldEnum | ComponentScalarFieldEnum[]
  }

  /**
   * Component create
   */
  export type ComponentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * The data needed to create a Component.
     */
    data: XOR<ComponentCreateInput, ComponentUncheckedCreateInput>
  }

  /**
   * Component createMany
   */
  export type ComponentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Components.
     */
    data: ComponentCreateManyInput | ComponentCreateManyInput[]
  }

  /**
   * Component createManyAndReturn
   */
  export type ComponentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * The data used to create many Components.
     */
    data: ComponentCreateManyInput | ComponentCreateManyInput[]
  }

  /**
   * Component update
   */
  export type ComponentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * The data needed to update a Component.
     */
    data: XOR<ComponentUpdateInput, ComponentUncheckedUpdateInput>
    /**
     * Choose, which Component to update.
     */
    where: ComponentWhereUniqueInput
  }

  /**
   * Component updateMany
   */
  export type ComponentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Components.
     */
    data: XOR<ComponentUpdateManyMutationInput, ComponentUncheckedUpdateManyInput>
    /**
     * Filter which Components to update
     */
    where?: ComponentWhereInput
    /**
     * Limit how many Components to update.
     */
    limit?: number
  }

  /**
   * Component updateManyAndReturn
   */
  export type ComponentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * The data used to update Components.
     */
    data: XOR<ComponentUpdateManyMutationInput, ComponentUncheckedUpdateManyInput>
    /**
     * Filter which Components to update
     */
    where?: ComponentWhereInput
    /**
     * Limit how many Components to update.
     */
    limit?: number
  }

  /**
   * Component upsert
   */
  export type ComponentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * The filter to search for the Component to update in case it exists.
     */
    where: ComponentWhereUniqueInput
    /**
     * In case the Component found by the `where` argument doesn't exist, create a new Component with this data.
     */
    create: XOR<ComponentCreateInput, ComponentUncheckedCreateInput>
    /**
     * In case the Component was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ComponentUpdateInput, ComponentUncheckedUpdateInput>
  }

  /**
   * Component delete
   */
  export type ComponentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
    /**
     * Filter which Component to delete.
     */
    where: ComponentWhereUniqueInput
  }

  /**
   * Component deleteMany
   */
  export type ComponentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Components to delete
     */
    where?: ComponentWhereInput
    /**
     * Limit how many Components to delete.
     */
    limit?: number
  }

  /**
   * Component without action
   */
  export type ComponentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Component
     */
    select?: ComponentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Component
     */
    omit?: ComponentOmit<ExtArgs> | null
  }


  /**
   * Model Product
   */

  export type AggregateProduct = {
    _count: ProductCountAggregateOutputType | null
    _avg: ProductAvgAggregateOutputType | null
    _sum: ProductSumAggregateOutputType | null
    _min: ProductMinAggregateOutputType | null
    _max: ProductMaxAggregateOutputType | null
  }

  export type ProductAvgAggregateOutputType = {
    timerA: number | null
    timerB: number | null
    totalCost: number | null
    sellingPrice: number | null
    realizedMargin: number | null
  }

  export type ProductSumAggregateOutputType = {
    timerA: number | null
    timerB: number | null
    totalCost: number | null
    sellingPrice: number | null
    realizedMargin: number | null
  }

  export type ProductMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    addon: string | null
    handle: string | null
    meat1: string | null
    meat2: string | null
    option1: string | null
    option2: string | null
    serveware: string | null
    timerA: number | null
    timerB: number | null
    skuSearch: string | null
    variantSku: string | null
    totalCost: number | null
    sellingPrice: number | null
    realizedMargin: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProductMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    addon: string | null
    handle: string | null
    meat1: string | null
    meat2: string | null
    option1: string | null
    option2: string | null
    serveware: string | null
    timerA: number | null
    timerB: number | null
    skuSearch: string | null
    variantSku: string | null
    totalCost: number | null
    sellingPrice: number | null
    realizedMargin: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProductCountAggregateOutputType = {
    id: number
    name: number
    description: number
    addon: number
    handle: number
    meat1: number
    meat2: number
    option1: number
    option2: number
    serveware: number
    timerA: number
    timerB: number
    skuSearch: number
    variantSku: number
    ingredients: number
    totalCost: number
    sellingPrice: number
    realizedMargin: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ProductAvgAggregateInputType = {
    timerA?: true
    timerB?: true
    totalCost?: true
    sellingPrice?: true
    realizedMargin?: true
  }

  export type ProductSumAggregateInputType = {
    timerA?: true
    timerB?: true
    totalCost?: true
    sellingPrice?: true
    realizedMargin?: true
  }

  export type ProductMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    addon?: true
    handle?: true
    meat1?: true
    meat2?: true
    option1?: true
    option2?: true
    serveware?: true
    timerA?: true
    timerB?: true
    skuSearch?: true
    variantSku?: true
    totalCost?: true
    sellingPrice?: true
    realizedMargin?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProductMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    addon?: true
    handle?: true
    meat1?: true
    meat2?: true
    option1?: true
    option2?: true
    serveware?: true
    timerA?: true
    timerB?: true
    skuSearch?: true
    variantSku?: true
    totalCost?: true
    sellingPrice?: true
    realizedMargin?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProductCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    addon?: true
    handle?: true
    meat1?: true
    meat2?: true
    option1?: true
    option2?: true
    serveware?: true
    timerA?: true
    timerB?: true
    skuSearch?: true
    variantSku?: true
    ingredients?: true
    totalCost?: true
    sellingPrice?: true
    realizedMargin?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ProductAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Product to aggregate.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Products
    **/
    _count?: true | ProductCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ProductAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ProductSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProductMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProductMaxAggregateInputType
  }

  export type GetProductAggregateType<T extends ProductAggregateArgs> = {
        [P in keyof T & keyof AggregateProduct]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProduct[P]>
      : GetScalarType<T[P], AggregateProduct[P]>
  }




  export type ProductGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProductWhereInput
    orderBy?: ProductOrderByWithAggregationInput | ProductOrderByWithAggregationInput[]
    by: ProductScalarFieldEnum[] | ProductScalarFieldEnum
    having?: ProductScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProductCountAggregateInputType | true
    _avg?: ProductAvgAggregateInputType
    _sum?: ProductSumAggregateInputType
    _min?: ProductMinAggregateInputType
    _max?: ProductMaxAggregateInputType
  }

  export type ProductGroupByOutputType = {
    id: string
    name: string | null
    description: string | null
    addon: string | null
    handle: string | null
    meat1: string | null
    meat2: string | null
    option1: string | null
    option2: string | null
    serveware: string | null
    timerA: number | null
    timerB: number | null
    skuSearch: string | null
    variantSku: string | null
    ingredients: JsonValue | null
    totalCost: number
    sellingPrice: number | null
    realizedMargin: number | null
    createdAt: Date
    updatedAt: Date
    _count: ProductCountAggregateOutputType | null
    _avg: ProductAvgAggregateOutputType | null
    _sum: ProductSumAggregateOutputType | null
    _min: ProductMinAggregateOutputType | null
    _max: ProductMaxAggregateOutputType | null
  }

  type GetProductGroupByPayload<T extends ProductGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProductGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProductGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProductGroupByOutputType[P]>
            : GetScalarType<T[P], ProductGroupByOutputType[P]>
        }
      >
    >


  export type ProductSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    addon?: boolean
    handle?: boolean
    meat1?: boolean
    meat2?: boolean
    option1?: boolean
    option2?: boolean
    serveware?: boolean
    timerA?: boolean
    timerB?: boolean
    skuSearch?: boolean
    variantSku?: boolean
    ingredients?: boolean
    totalCost?: boolean
    sellingPrice?: boolean
    realizedMargin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["product"]>

  export type ProductSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    addon?: boolean
    handle?: boolean
    meat1?: boolean
    meat2?: boolean
    option1?: boolean
    option2?: boolean
    serveware?: boolean
    timerA?: boolean
    timerB?: boolean
    skuSearch?: boolean
    variantSku?: boolean
    ingredients?: boolean
    totalCost?: boolean
    sellingPrice?: boolean
    realizedMargin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["product"]>

  export type ProductSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    addon?: boolean
    handle?: boolean
    meat1?: boolean
    meat2?: boolean
    option1?: boolean
    option2?: boolean
    serveware?: boolean
    timerA?: boolean
    timerB?: boolean
    skuSearch?: boolean
    variantSku?: boolean
    ingredients?: boolean
    totalCost?: boolean
    sellingPrice?: boolean
    realizedMargin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["product"]>

  export type ProductSelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    addon?: boolean
    handle?: boolean
    meat1?: boolean
    meat2?: boolean
    option1?: boolean
    option2?: boolean
    serveware?: boolean
    timerA?: boolean
    timerB?: boolean
    skuSearch?: boolean
    variantSku?: boolean
    ingredients?: boolean
    totalCost?: boolean
    sellingPrice?: boolean
    realizedMargin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ProductOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "description" | "addon" | "handle" | "meat1" | "meat2" | "option1" | "option2" | "serveware" | "timerA" | "timerB" | "skuSearch" | "variantSku" | "ingredients" | "totalCost" | "sellingPrice" | "realizedMargin" | "createdAt" | "updatedAt", ExtArgs["result"]["product"]>

  export type $ProductPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Product"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string | null
      description: string | null
      addon: string | null
      handle: string | null
      meat1: string | null
      meat2: string | null
      option1: string | null
      option2: string | null
      serveware: string | null
      timerA: number | null
      timerB: number | null
      skuSearch: string | null
      variantSku: string | null
      ingredients: Prisma.JsonValue | null
      totalCost: number
      sellingPrice: number | null
      realizedMargin: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["product"]>
    composites: {}
  }

  type ProductGetPayload<S extends boolean | null | undefined | ProductDefaultArgs> = $Result.GetResult<Prisma.$ProductPayload, S>

  type ProductCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ProductFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ProductCountAggregateInputType | true
    }

  export interface ProductDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Product'], meta: { name: 'Product' } }
    /**
     * Find zero or one Product that matches the filter.
     * @param {ProductFindUniqueArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ProductFindUniqueArgs>(args: SelectSubset<T, ProductFindUniqueArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Product that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ProductFindUniqueOrThrowArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ProductFindUniqueOrThrowArgs>(args: SelectSubset<T, ProductFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Product that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindFirstArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ProductFindFirstArgs>(args?: SelectSubset<T, ProductFindFirstArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Product that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindFirstOrThrowArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ProductFindFirstOrThrowArgs>(args?: SelectSubset<T, ProductFindFirstOrThrowArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Products that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Products
     * const products = await prisma.product.findMany()
     * 
     * // Get first 10 Products
     * const products = await prisma.product.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const productWithIdOnly = await prisma.product.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ProductFindManyArgs>(args?: SelectSubset<T, ProductFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Product.
     * @param {ProductCreateArgs} args - Arguments to create a Product.
     * @example
     * // Create one Product
     * const Product = await prisma.product.create({
     *   data: {
     *     // ... data to create a Product
     *   }
     * })
     * 
     */
    create<T extends ProductCreateArgs>(args: SelectSubset<T, ProductCreateArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Products.
     * @param {ProductCreateManyArgs} args - Arguments to create many Products.
     * @example
     * // Create many Products
     * const product = await prisma.product.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ProductCreateManyArgs>(args?: SelectSubset<T, ProductCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Products and returns the data saved in the database.
     * @param {ProductCreateManyAndReturnArgs} args - Arguments to create many Products.
     * @example
     * // Create many Products
     * const product = await prisma.product.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Products and only return the `id`
     * const productWithIdOnly = await prisma.product.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ProductCreateManyAndReturnArgs>(args?: SelectSubset<T, ProductCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Product.
     * @param {ProductDeleteArgs} args - Arguments to delete one Product.
     * @example
     * // Delete one Product
     * const Product = await prisma.product.delete({
     *   where: {
     *     // ... filter to delete one Product
     *   }
     * })
     * 
     */
    delete<T extends ProductDeleteArgs>(args: SelectSubset<T, ProductDeleteArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Product.
     * @param {ProductUpdateArgs} args - Arguments to update one Product.
     * @example
     * // Update one Product
     * const product = await prisma.product.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ProductUpdateArgs>(args: SelectSubset<T, ProductUpdateArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Products.
     * @param {ProductDeleteManyArgs} args - Arguments to filter Products to delete.
     * @example
     * // Delete a few Products
     * const { count } = await prisma.product.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ProductDeleteManyArgs>(args?: SelectSubset<T, ProductDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Products.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Products
     * const product = await prisma.product.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ProductUpdateManyArgs>(args: SelectSubset<T, ProductUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Products and returns the data updated in the database.
     * @param {ProductUpdateManyAndReturnArgs} args - Arguments to update many Products.
     * @example
     * // Update many Products
     * const product = await prisma.product.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Products and only return the `id`
     * const productWithIdOnly = await prisma.product.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ProductUpdateManyAndReturnArgs>(args: SelectSubset<T, ProductUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Product.
     * @param {ProductUpsertArgs} args - Arguments to update or create a Product.
     * @example
     * // Update or create a Product
     * const product = await prisma.product.upsert({
     *   create: {
     *     // ... data to create a Product
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Product we want to update
     *   }
     * })
     */
    upsert<T extends ProductUpsertArgs>(args: SelectSubset<T, ProductUpsertArgs<ExtArgs>>): Prisma__ProductClient<$Result.GetResult<Prisma.$ProductPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Products.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductCountArgs} args - Arguments to filter Products to count.
     * @example
     * // Count the number of Products
     * const count = await prisma.product.count({
     *   where: {
     *     // ... the filter for the Products we want to count
     *   }
     * })
    **/
    count<T extends ProductCountArgs>(
      args?: Subset<T, ProductCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProductCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Product.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProductAggregateArgs>(args: Subset<T, ProductAggregateArgs>): Prisma.PrismaPromise<GetProductAggregateType<T>>

    /**
     * Group by Product.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProductGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProductGroupByArgs['orderBy'] }
        : { orderBy?: ProductGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProductGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProductGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Product model
   */
  readonly fields: ProductFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Product.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ProductClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Product model
   */
  interface ProductFieldRefs {
    readonly id: FieldRef<"Product", 'String'>
    readonly name: FieldRef<"Product", 'String'>
    readonly description: FieldRef<"Product", 'String'>
    readonly addon: FieldRef<"Product", 'String'>
    readonly handle: FieldRef<"Product", 'String'>
    readonly meat1: FieldRef<"Product", 'String'>
    readonly meat2: FieldRef<"Product", 'String'>
    readonly option1: FieldRef<"Product", 'String'>
    readonly option2: FieldRef<"Product", 'String'>
    readonly serveware: FieldRef<"Product", 'String'>
    readonly timerA: FieldRef<"Product", 'Int'>
    readonly timerB: FieldRef<"Product", 'Int'>
    readonly skuSearch: FieldRef<"Product", 'String'>
    readonly variantSku: FieldRef<"Product", 'String'>
    readonly ingredients: FieldRef<"Product", 'Json'>
    readonly totalCost: FieldRef<"Product", 'Float'>
    readonly sellingPrice: FieldRef<"Product", 'Float'>
    readonly realizedMargin: FieldRef<"Product", 'Float'>
    readonly createdAt: FieldRef<"Product", 'DateTime'>
    readonly updatedAt: FieldRef<"Product", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Product findUnique
   */
  export type ProductFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product findUniqueOrThrow
   */
  export type ProductFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product findFirst
   */
  export type ProductFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Products.
     */
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Product findFirstOrThrow
   */
  export type ProductFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Products.
     */
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Product findMany
   */
  export type ProductFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * Filter, which Products to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }

  /**
   * Product create
   */
  export type ProductCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * The data needed to create a Product.
     */
    data: XOR<ProductCreateInput, ProductUncheckedCreateInput>
  }

  /**
   * Product createMany
   */
  export type ProductCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Products.
     */
    data: ProductCreateManyInput | ProductCreateManyInput[]
  }

  /**
   * Product createManyAndReturn
   */
  export type ProductCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * The data used to create many Products.
     */
    data: ProductCreateManyInput | ProductCreateManyInput[]
  }

  /**
   * Product update
   */
  export type ProductUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * The data needed to update a Product.
     */
    data: XOR<ProductUpdateInput, ProductUncheckedUpdateInput>
    /**
     * Choose, which Product to update.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product updateMany
   */
  export type ProductUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Products.
     */
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyInput>
    /**
     * Filter which Products to update
     */
    where?: ProductWhereInput
    /**
     * Limit how many Products to update.
     */
    limit?: number
  }

  /**
   * Product updateManyAndReturn
   */
  export type ProductUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * The data used to update Products.
     */
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyInput>
    /**
     * Filter which Products to update
     */
    where?: ProductWhereInput
    /**
     * Limit how many Products to update.
     */
    limit?: number
  }

  /**
   * Product upsert
   */
  export type ProductUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * The filter to search for the Product to update in case it exists.
     */
    where: ProductWhereUniqueInput
    /**
     * In case the Product found by the `where` argument doesn't exist, create a new Product with this data.
     */
    create: XOR<ProductCreateInput, ProductUncheckedCreateInput>
    /**
     * In case the Product was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProductUpdateInput, ProductUncheckedUpdateInput>
  }

  /**
   * Product delete
   */
  export type ProductDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
    /**
     * Filter which Product to delete.
     */
    where: ProductWhereUniqueInput
  }

  /**
   * Product deleteMany
   */
  export type ProductDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Products to delete
     */
    where?: ProductWhereInput
    /**
     * Limit how many Products to delete.
     */
    limit?: number
  }

  /**
   * Product without action
   */
  export type ProductDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Product
     */
    omit?: ProductOmit<ExtArgs> | null
  }


  /**
   * Model Staff
   */

  export type AggregateStaff = {
    _count: StaffCountAggregateOutputType | null
    _avg: StaffAvgAggregateOutputType | null
    _sum: StaffSumAggregateOutputType | null
    _min: StaffMinAggregateOutputType | null
    _max: StaffMaxAggregateOutputType | null
  }

  export type StaffAvgAggregateOutputType = {
    payRate: number | null
  }

  export type StaffSumAggregateOutputType = {
    payRate: number | null
  }

  export type StaffMinAggregateOutputType = {
    id: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
    email: string | null
    payRate: number | null
    accessLevel: string | null
    isDriver: boolean | null
    password: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
    lastLogin: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type StaffMaxAggregateOutputType = {
    id: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
    email: string | null
    payRate: number | null
    accessLevel: string | null
    isDriver: boolean | null
    password: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
    lastLogin: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type StaffCountAggregateOutputType = {
    id: number
    firstName: number
    lastName: number
    phone: number
    email: number
    payRate: number
    accessLevel: number
    isDriver: number
    password: number
    resetToken: number
    resetTokenExpiry: number
    lastLogin: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type StaffAvgAggregateInputType = {
    payRate?: true
  }

  export type StaffSumAggregateInputType = {
    payRate?: true
  }

  export type StaffMinAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone?: true
    email?: true
    payRate?: true
    accessLevel?: true
    isDriver?: true
    password?: true
    resetToken?: true
    resetTokenExpiry?: true
    lastLogin?: true
    createdAt?: true
    updatedAt?: true
  }

  export type StaffMaxAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone?: true
    email?: true
    payRate?: true
    accessLevel?: true
    isDriver?: true
    password?: true
    resetToken?: true
    resetTokenExpiry?: true
    lastLogin?: true
    createdAt?: true
    updatedAt?: true
  }

  export type StaffCountAggregateInputType = {
    id?: true
    firstName?: true
    lastName?: true
    phone?: true
    email?: true
    payRate?: true
    accessLevel?: true
    isDriver?: true
    password?: true
    resetToken?: true
    resetTokenExpiry?: true
    lastLogin?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type StaffAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Staff to aggregate.
     */
    where?: StaffWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Staff to fetch.
     */
    orderBy?: StaffOrderByWithRelationInput | StaffOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: StaffWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Staff from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Staff.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Staff
    **/
    _count?: true | StaffCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: StaffAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: StaffSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: StaffMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: StaffMaxAggregateInputType
  }

  export type GetStaffAggregateType<T extends StaffAggregateArgs> = {
        [P in keyof T & keyof AggregateStaff]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateStaff[P]>
      : GetScalarType<T[P], AggregateStaff[P]>
  }




  export type StaffGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: StaffWhereInput
    orderBy?: StaffOrderByWithAggregationInput | StaffOrderByWithAggregationInput[]
    by: StaffScalarFieldEnum[] | StaffScalarFieldEnum
    having?: StaffScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: StaffCountAggregateInputType | true
    _avg?: StaffAvgAggregateInputType
    _sum?: StaffSumAggregateInputType
    _min?: StaffMinAggregateInputType
    _max?: StaffMaxAggregateInputType
  }

  export type StaffGroupByOutputType = {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
    payRate: number
    accessLevel: string
    isDriver: boolean
    password: string | null
    resetToken: string | null
    resetTokenExpiry: Date | null
    lastLogin: Date | null
    createdAt: Date
    updatedAt: Date
    _count: StaffCountAggregateOutputType | null
    _avg: StaffAvgAggregateOutputType | null
    _sum: StaffSumAggregateOutputType | null
    _min: StaffMinAggregateOutputType | null
    _max: StaffMaxAggregateOutputType | null
  }

  type GetStaffGroupByPayload<T extends StaffGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<StaffGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof StaffGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], StaffGroupByOutputType[P]>
            : GetScalarType<T[P], StaffGroupByOutputType[P]>
        }
      >
    >


  export type StaffSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone?: boolean
    email?: boolean
    payRate?: boolean
    accessLevel?: boolean
    isDriver?: boolean
    password?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    lastLogin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["staff"]>

  export type StaffSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone?: boolean
    email?: boolean
    payRate?: boolean
    accessLevel?: boolean
    isDriver?: boolean
    password?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    lastLogin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["staff"]>

  export type StaffSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone?: boolean
    email?: boolean
    payRate?: boolean
    accessLevel?: boolean
    isDriver?: boolean
    password?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    lastLogin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["staff"]>

  export type StaffSelectScalar = {
    id?: boolean
    firstName?: boolean
    lastName?: boolean
    phone?: boolean
    email?: boolean
    payRate?: boolean
    accessLevel?: boolean
    isDriver?: boolean
    password?: boolean
    resetToken?: boolean
    resetTokenExpiry?: boolean
    lastLogin?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type StaffOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "firstName" | "lastName" | "phone" | "email" | "payRate" | "accessLevel" | "isDriver" | "password" | "resetToken" | "resetTokenExpiry" | "lastLogin" | "createdAt" | "updatedAt", ExtArgs["result"]["staff"]>

  export type $StaffPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Staff"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      firstName: string
      lastName: string
      phone: string
      email: string
      payRate: number
      accessLevel: string
      isDriver: boolean
      password: string | null
      resetToken: string | null
      resetTokenExpiry: Date | null
      lastLogin: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["staff"]>
    composites: {}
  }

  type StaffGetPayload<S extends boolean | null | undefined | StaffDefaultArgs> = $Result.GetResult<Prisma.$StaffPayload, S>

  type StaffCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<StaffFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: StaffCountAggregateInputType | true
    }

  export interface StaffDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Staff'], meta: { name: 'Staff' } }
    /**
     * Find zero or one Staff that matches the filter.
     * @param {StaffFindUniqueArgs} args - Arguments to find a Staff
     * @example
     * // Get one Staff
     * const staff = await prisma.staff.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends StaffFindUniqueArgs>(args: SelectSubset<T, StaffFindUniqueArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Staff that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {StaffFindUniqueOrThrowArgs} args - Arguments to find a Staff
     * @example
     * // Get one Staff
     * const staff = await prisma.staff.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends StaffFindUniqueOrThrowArgs>(args: SelectSubset<T, StaffFindUniqueOrThrowArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Staff that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffFindFirstArgs} args - Arguments to find a Staff
     * @example
     * // Get one Staff
     * const staff = await prisma.staff.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends StaffFindFirstArgs>(args?: SelectSubset<T, StaffFindFirstArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Staff that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffFindFirstOrThrowArgs} args - Arguments to find a Staff
     * @example
     * // Get one Staff
     * const staff = await prisma.staff.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends StaffFindFirstOrThrowArgs>(args?: SelectSubset<T, StaffFindFirstOrThrowArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Staff that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Staff
     * const staff = await prisma.staff.findMany()
     * 
     * // Get first 10 Staff
     * const staff = await prisma.staff.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const staffWithIdOnly = await prisma.staff.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends StaffFindManyArgs>(args?: SelectSubset<T, StaffFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Staff.
     * @param {StaffCreateArgs} args - Arguments to create a Staff.
     * @example
     * // Create one Staff
     * const Staff = await prisma.staff.create({
     *   data: {
     *     // ... data to create a Staff
     *   }
     * })
     * 
     */
    create<T extends StaffCreateArgs>(args: SelectSubset<T, StaffCreateArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Staff.
     * @param {StaffCreateManyArgs} args - Arguments to create many Staff.
     * @example
     * // Create many Staff
     * const staff = await prisma.staff.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends StaffCreateManyArgs>(args?: SelectSubset<T, StaffCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Staff and returns the data saved in the database.
     * @param {StaffCreateManyAndReturnArgs} args - Arguments to create many Staff.
     * @example
     * // Create many Staff
     * const staff = await prisma.staff.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Staff and only return the `id`
     * const staffWithIdOnly = await prisma.staff.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends StaffCreateManyAndReturnArgs>(args?: SelectSubset<T, StaffCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Staff.
     * @param {StaffDeleteArgs} args - Arguments to delete one Staff.
     * @example
     * // Delete one Staff
     * const Staff = await prisma.staff.delete({
     *   where: {
     *     // ... filter to delete one Staff
     *   }
     * })
     * 
     */
    delete<T extends StaffDeleteArgs>(args: SelectSubset<T, StaffDeleteArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Staff.
     * @param {StaffUpdateArgs} args - Arguments to update one Staff.
     * @example
     * // Update one Staff
     * const staff = await prisma.staff.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends StaffUpdateArgs>(args: SelectSubset<T, StaffUpdateArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Staff.
     * @param {StaffDeleteManyArgs} args - Arguments to filter Staff to delete.
     * @example
     * // Delete a few Staff
     * const { count } = await prisma.staff.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends StaffDeleteManyArgs>(args?: SelectSubset<T, StaffDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Staff.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Staff
     * const staff = await prisma.staff.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends StaffUpdateManyArgs>(args: SelectSubset<T, StaffUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Staff and returns the data updated in the database.
     * @param {StaffUpdateManyAndReturnArgs} args - Arguments to update many Staff.
     * @example
     * // Update many Staff
     * const staff = await prisma.staff.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Staff and only return the `id`
     * const staffWithIdOnly = await prisma.staff.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends StaffUpdateManyAndReturnArgs>(args: SelectSubset<T, StaffUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Staff.
     * @param {StaffUpsertArgs} args - Arguments to update or create a Staff.
     * @example
     * // Update or create a Staff
     * const staff = await prisma.staff.upsert({
     *   create: {
     *     // ... data to create a Staff
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Staff we want to update
     *   }
     * })
     */
    upsert<T extends StaffUpsertArgs>(args: SelectSubset<T, StaffUpsertArgs<ExtArgs>>): Prisma__StaffClient<$Result.GetResult<Prisma.$StaffPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Staff.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffCountArgs} args - Arguments to filter Staff to count.
     * @example
     * // Count the number of Staff
     * const count = await prisma.staff.count({
     *   where: {
     *     // ... the filter for the Staff we want to count
     *   }
     * })
    **/
    count<T extends StaffCountArgs>(
      args?: Subset<T, StaffCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], StaffCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Staff.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends StaffAggregateArgs>(args: Subset<T, StaffAggregateArgs>): Prisma.PrismaPromise<GetStaffAggregateType<T>>

    /**
     * Group by Staff.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StaffGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends StaffGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: StaffGroupByArgs['orderBy'] }
        : { orderBy?: StaffGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, StaffGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetStaffGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Staff model
   */
  readonly fields: StaffFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Staff.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__StaffClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Staff model
   */
  interface StaffFieldRefs {
    readonly id: FieldRef<"Staff", 'String'>
    readonly firstName: FieldRef<"Staff", 'String'>
    readonly lastName: FieldRef<"Staff", 'String'>
    readonly phone: FieldRef<"Staff", 'String'>
    readonly email: FieldRef<"Staff", 'String'>
    readonly payRate: FieldRef<"Staff", 'Float'>
    readonly accessLevel: FieldRef<"Staff", 'String'>
    readonly isDriver: FieldRef<"Staff", 'Boolean'>
    readonly password: FieldRef<"Staff", 'String'>
    readonly resetToken: FieldRef<"Staff", 'String'>
    readonly resetTokenExpiry: FieldRef<"Staff", 'DateTime'>
    readonly lastLogin: FieldRef<"Staff", 'DateTime'>
    readonly createdAt: FieldRef<"Staff", 'DateTime'>
    readonly updatedAt: FieldRef<"Staff", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Staff findUnique
   */
  export type StaffFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * Filter, which Staff to fetch.
     */
    where: StaffWhereUniqueInput
  }

  /**
   * Staff findUniqueOrThrow
   */
  export type StaffFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * Filter, which Staff to fetch.
     */
    where: StaffWhereUniqueInput
  }

  /**
   * Staff findFirst
   */
  export type StaffFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * Filter, which Staff to fetch.
     */
    where?: StaffWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Staff to fetch.
     */
    orderBy?: StaffOrderByWithRelationInput | StaffOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Staff.
     */
    cursor?: StaffWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Staff from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Staff.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Staff.
     */
    distinct?: StaffScalarFieldEnum | StaffScalarFieldEnum[]
  }

  /**
   * Staff findFirstOrThrow
   */
  export type StaffFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * Filter, which Staff to fetch.
     */
    where?: StaffWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Staff to fetch.
     */
    orderBy?: StaffOrderByWithRelationInput | StaffOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Staff.
     */
    cursor?: StaffWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Staff from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Staff.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Staff.
     */
    distinct?: StaffScalarFieldEnum | StaffScalarFieldEnum[]
  }

  /**
   * Staff findMany
   */
  export type StaffFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * Filter, which Staff to fetch.
     */
    where?: StaffWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Staff to fetch.
     */
    orderBy?: StaffOrderByWithRelationInput | StaffOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Staff.
     */
    cursor?: StaffWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Staff from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Staff.
     */
    skip?: number
    distinct?: StaffScalarFieldEnum | StaffScalarFieldEnum[]
  }

  /**
   * Staff create
   */
  export type StaffCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * The data needed to create a Staff.
     */
    data: XOR<StaffCreateInput, StaffUncheckedCreateInput>
  }

  /**
   * Staff createMany
   */
  export type StaffCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Staff.
     */
    data: StaffCreateManyInput | StaffCreateManyInput[]
  }

  /**
   * Staff createManyAndReturn
   */
  export type StaffCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * The data used to create many Staff.
     */
    data: StaffCreateManyInput | StaffCreateManyInput[]
  }

  /**
   * Staff update
   */
  export type StaffUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * The data needed to update a Staff.
     */
    data: XOR<StaffUpdateInput, StaffUncheckedUpdateInput>
    /**
     * Choose, which Staff to update.
     */
    where: StaffWhereUniqueInput
  }

  /**
   * Staff updateMany
   */
  export type StaffUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Staff.
     */
    data: XOR<StaffUpdateManyMutationInput, StaffUncheckedUpdateManyInput>
    /**
     * Filter which Staff to update
     */
    where?: StaffWhereInput
    /**
     * Limit how many Staff to update.
     */
    limit?: number
  }

  /**
   * Staff updateManyAndReturn
   */
  export type StaffUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * The data used to update Staff.
     */
    data: XOR<StaffUpdateManyMutationInput, StaffUncheckedUpdateManyInput>
    /**
     * Filter which Staff to update
     */
    where?: StaffWhereInput
    /**
     * Limit how many Staff to update.
     */
    limit?: number
  }

  /**
   * Staff upsert
   */
  export type StaffUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * The filter to search for the Staff to update in case it exists.
     */
    where: StaffWhereUniqueInput
    /**
     * In case the Staff found by the `where` argument doesn't exist, create a new Staff with this data.
     */
    create: XOR<StaffCreateInput, StaffUncheckedCreateInput>
    /**
     * In case the Staff was found with the provided `where` argument, update it with this data.
     */
    update: XOR<StaffUpdateInput, StaffUncheckedUpdateInput>
  }

  /**
   * Staff delete
   */
  export type StaffDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
    /**
     * Filter which Staff to delete.
     */
    where: StaffWhereUniqueInput
  }

  /**
   * Staff deleteMany
   */
  export type StaffDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Staff to delete
     */
    where?: StaffWhereInput
    /**
     * Limit how many Staff to delete.
     */
    limit?: number
  }

  /**
   * Staff without action
   */
  export type StaffDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Staff
     */
    select?: StaffSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Staff
     */
    omit?: StaffOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const GilmoursProductScalarFieldEnum: {
    id: 'id',
    sku: 'sku',
    brand: 'brand',
    description: 'description',
    packSize: 'packSize',
    uom: 'uom',
    price: 'price',
    quantity: 'quantity',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type GilmoursProductScalarFieldEnum = (typeof GilmoursProductScalarFieldEnum)[keyof typeof GilmoursProductScalarFieldEnum]


  export const BidfoodProductScalarFieldEnum: {
    id: 'id',
    productCode: 'productCode',
    brand: 'brand',
    description: 'description',
    packSize: 'packSize',
    ctnQty: 'ctnQty',
    uom: 'uom',
    qty: 'qty',
    lastPricePaid: 'lastPricePaid',
    totalExGST: 'totalExGST',
    contains: 'contains',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type BidfoodProductScalarFieldEnum = (typeof BidfoodProductScalarFieldEnum)[keyof typeof BidfoodProductScalarFieldEnum]


  export const OtherProductScalarFieldEnum: {
    id: 'id',
    name: 'name',
    supplier: 'supplier',
    description: 'description',
    cost: 'cost',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type OtherProductScalarFieldEnum = (typeof OtherProductScalarFieldEnum)[keyof typeof OtherProductScalarFieldEnum]


  export const SupplierScalarFieldEnum: {
    id: 'id',
    name: 'name',
    contactName: 'contactName',
    contactNumber: 'contactNumber',
    contactEmail: 'contactEmail',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SupplierScalarFieldEnum = (typeof SupplierScalarFieldEnum)[keyof typeof SupplierScalarFieldEnum]


  export const ComponentScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    ingredients: 'ingredients',
    totalCost: 'totalCost',
    hasGluten: 'hasGluten',
    hasDairy: 'hasDairy',
    hasSoy: 'hasSoy',
    hasOnionGarlic: 'hasOnionGarlic',
    hasSesame: 'hasSesame',
    hasNuts: 'hasNuts',
    hasEgg: 'hasEgg',
    isVegetarian: 'isVegetarian',
    isVegan: 'isVegan',
    isHalal: 'isHalal',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ComponentScalarFieldEnum = (typeof ComponentScalarFieldEnum)[keyof typeof ComponentScalarFieldEnum]


  export const ProductScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    addon: 'addon',
    handle: 'handle',
    meat1: 'meat1',
    meat2: 'meat2',
    option1: 'option1',
    option2: 'option2',
    serveware: 'serveware',
    timerA: 'timerA',
    timerB: 'timerB',
    skuSearch: 'skuSearch',
    variantSku: 'variantSku',
    ingredients: 'ingredients',
    totalCost: 'totalCost',
    sellingPrice: 'sellingPrice',
    realizedMargin: 'realizedMargin',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ProductScalarFieldEnum = (typeof ProductScalarFieldEnum)[keyof typeof ProductScalarFieldEnum]


  export const StaffScalarFieldEnum: {
    id: 'id',
    firstName: 'firstName',
    lastName: 'lastName',
    phone: 'phone',
    email: 'email',
    payRate: 'payRate',
    accessLevel: 'accessLevel',
    isDriver: 'isDriver',
    password: 'password',
    resetToken: 'resetToken',
    resetTokenExpiry: 'resetTokenExpiry',
    lastLogin: 'lastLogin',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type StaffScalarFieldEnum = (typeof StaffScalarFieldEnum)[keyof typeof StaffScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    
  /**
   * Deep Input Types
   */


  export type GilmoursProductWhereInput = {
    AND?: GilmoursProductWhereInput | GilmoursProductWhereInput[]
    OR?: GilmoursProductWhereInput[]
    NOT?: GilmoursProductWhereInput | GilmoursProductWhereInput[]
    id?: StringFilter<"GilmoursProduct"> | string
    sku?: StringFilter<"GilmoursProduct"> | string
    brand?: StringFilter<"GilmoursProduct"> | string
    description?: StringFilter<"GilmoursProduct"> | string
    packSize?: StringFilter<"GilmoursProduct"> | string
    uom?: StringFilter<"GilmoursProduct"> | string
    price?: FloatFilter<"GilmoursProduct"> | number
    quantity?: IntFilter<"GilmoursProduct"> | number
    createdAt?: DateTimeFilter<"GilmoursProduct"> | Date | string
    updatedAt?: DateTimeFilter<"GilmoursProduct"> | Date | string
  }

  export type GilmoursProductOrderByWithRelationInput = {
    id?: SortOrder
    sku?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    uom?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GilmoursProductWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    sku?: string
    AND?: GilmoursProductWhereInput | GilmoursProductWhereInput[]
    OR?: GilmoursProductWhereInput[]
    NOT?: GilmoursProductWhereInput | GilmoursProductWhereInput[]
    brand?: StringFilter<"GilmoursProduct"> | string
    description?: StringFilter<"GilmoursProduct"> | string
    packSize?: StringFilter<"GilmoursProduct"> | string
    uom?: StringFilter<"GilmoursProduct"> | string
    price?: FloatFilter<"GilmoursProduct"> | number
    quantity?: IntFilter<"GilmoursProduct"> | number
    createdAt?: DateTimeFilter<"GilmoursProduct"> | Date | string
    updatedAt?: DateTimeFilter<"GilmoursProduct"> | Date | string
  }, "id" | "sku">

  export type GilmoursProductOrderByWithAggregationInput = {
    id?: SortOrder
    sku?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    uom?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: GilmoursProductCountOrderByAggregateInput
    _avg?: GilmoursProductAvgOrderByAggregateInput
    _max?: GilmoursProductMaxOrderByAggregateInput
    _min?: GilmoursProductMinOrderByAggregateInput
    _sum?: GilmoursProductSumOrderByAggregateInput
  }

  export type GilmoursProductScalarWhereWithAggregatesInput = {
    AND?: GilmoursProductScalarWhereWithAggregatesInput | GilmoursProductScalarWhereWithAggregatesInput[]
    OR?: GilmoursProductScalarWhereWithAggregatesInput[]
    NOT?: GilmoursProductScalarWhereWithAggregatesInput | GilmoursProductScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"GilmoursProduct"> | string
    sku?: StringWithAggregatesFilter<"GilmoursProduct"> | string
    brand?: StringWithAggregatesFilter<"GilmoursProduct"> | string
    description?: StringWithAggregatesFilter<"GilmoursProduct"> | string
    packSize?: StringWithAggregatesFilter<"GilmoursProduct"> | string
    uom?: StringWithAggregatesFilter<"GilmoursProduct"> | string
    price?: FloatWithAggregatesFilter<"GilmoursProduct"> | number
    quantity?: IntWithAggregatesFilter<"GilmoursProduct"> | number
    createdAt?: DateTimeWithAggregatesFilter<"GilmoursProduct"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"GilmoursProduct"> | Date | string
  }

  export type BidfoodProductWhereInput = {
    AND?: BidfoodProductWhereInput | BidfoodProductWhereInput[]
    OR?: BidfoodProductWhereInput[]
    NOT?: BidfoodProductWhereInput | BidfoodProductWhereInput[]
    id?: StringFilter<"BidfoodProduct"> | string
    productCode?: StringFilter<"BidfoodProduct"> | string
    brand?: StringFilter<"BidfoodProduct"> | string
    description?: StringFilter<"BidfoodProduct"> | string
    packSize?: StringFilter<"BidfoodProduct"> | string
    ctnQty?: StringFilter<"BidfoodProduct"> | string
    uom?: StringFilter<"BidfoodProduct"> | string
    qty?: IntFilter<"BidfoodProduct"> | number
    lastPricePaid?: FloatFilter<"BidfoodProduct"> | number
    totalExGST?: FloatFilter<"BidfoodProduct"> | number
    contains?: StringFilter<"BidfoodProduct"> | string
    createdAt?: DateTimeFilter<"BidfoodProduct"> | Date | string
    updatedAt?: DateTimeFilter<"BidfoodProduct"> | Date | string
  }

  export type BidfoodProductOrderByWithRelationInput = {
    id?: SortOrder
    productCode?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    ctnQty?: SortOrder
    uom?: SortOrder
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
    contains?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BidfoodProductWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    productCode?: string
    AND?: BidfoodProductWhereInput | BidfoodProductWhereInput[]
    OR?: BidfoodProductWhereInput[]
    NOT?: BidfoodProductWhereInput | BidfoodProductWhereInput[]
    brand?: StringFilter<"BidfoodProduct"> | string
    description?: StringFilter<"BidfoodProduct"> | string
    packSize?: StringFilter<"BidfoodProduct"> | string
    ctnQty?: StringFilter<"BidfoodProduct"> | string
    uom?: StringFilter<"BidfoodProduct"> | string
    qty?: IntFilter<"BidfoodProduct"> | number
    lastPricePaid?: FloatFilter<"BidfoodProduct"> | number
    totalExGST?: FloatFilter<"BidfoodProduct"> | number
    contains?: StringFilter<"BidfoodProduct"> | string
    createdAt?: DateTimeFilter<"BidfoodProduct"> | Date | string
    updatedAt?: DateTimeFilter<"BidfoodProduct"> | Date | string
  }, "id" | "productCode">

  export type BidfoodProductOrderByWithAggregationInput = {
    id?: SortOrder
    productCode?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    ctnQty?: SortOrder
    uom?: SortOrder
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
    contains?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: BidfoodProductCountOrderByAggregateInput
    _avg?: BidfoodProductAvgOrderByAggregateInput
    _max?: BidfoodProductMaxOrderByAggregateInput
    _min?: BidfoodProductMinOrderByAggregateInput
    _sum?: BidfoodProductSumOrderByAggregateInput
  }

  export type BidfoodProductScalarWhereWithAggregatesInput = {
    AND?: BidfoodProductScalarWhereWithAggregatesInput | BidfoodProductScalarWhereWithAggregatesInput[]
    OR?: BidfoodProductScalarWhereWithAggregatesInput[]
    NOT?: BidfoodProductScalarWhereWithAggregatesInput | BidfoodProductScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    productCode?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    brand?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    description?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    packSize?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    ctnQty?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    uom?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    qty?: IntWithAggregatesFilter<"BidfoodProduct"> | number
    lastPricePaid?: FloatWithAggregatesFilter<"BidfoodProduct"> | number
    totalExGST?: FloatWithAggregatesFilter<"BidfoodProduct"> | number
    contains?: StringWithAggregatesFilter<"BidfoodProduct"> | string
    createdAt?: DateTimeWithAggregatesFilter<"BidfoodProduct"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"BidfoodProduct"> | Date | string
  }

  export type OtherProductWhereInput = {
    AND?: OtherProductWhereInput | OtherProductWhereInput[]
    OR?: OtherProductWhereInput[]
    NOT?: OtherProductWhereInput | OtherProductWhereInput[]
    id?: StringFilter<"OtherProduct"> | string
    name?: StringFilter<"OtherProduct"> | string
    supplier?: StringFilter<"OtherProduct"> | string
    description?: StringFilter<"OtherProduct"> | string
    cost?: FloatFilter<"OtherProduct"> | number
    createdAt?: DateTimeFilter<"OtherProduct"> | Date | string
    updatedAt?: DateTimeFilter<"OtherProduct"> | Date | string
  }

  export type OtherProductOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    supplier?: SortOrder
    description?: SortOrder
    cost?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OtherProductWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: OtherProductWhereInput | OtherProductWhereInput[]
    OR?: OtherProductWhereInput[]
    NOT?: OtherProductWhereInput | OtherProductWhereInput[]
    name?: StringFilter<"OtherProduct"> | string
    supplier?: StringFilter<"OtherProduct"> | string
    description?: StringFilter<"OtherProduct"> | string
    cost?: FloatFilter<"OtherProduct"> | number
    createdAt?: DateTimeFilter<"OtherProduct"> | Date | string
    updatedAt?: DateTimeFilter<"OtherProduct"> | Date | string
  }, "id">

  export type OtherProductOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    supplier?: SortOrder
    description?: SortOrder
    cost?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: OtherProductCountOrderByAggregateInput
    _avg?: OtherProductAvgOrderByAggregateInput
    _max?: OtherProductMaxOrderByAggregateInput
    _min?: OtherProductMinOrderByAggregateInput
    _sum?: OtherProductSumOrderByAggregateInput
  }

  export type OtherProductScalarWhereWithAggregatesInput = {
    AND?: OtherProductScalarWhereWithAggregatesInput | OtherProductScalarWhereWithAggregatesInput[]
    OR?: OtherProductScalarWhereWithAggregatesInput[]
    NOT?: OtherProductScalarWhereWithAggregatesInput | OtherProductScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"OtherProduct"> | string
    name?: StringWithAggregatesFilter<"OtherProduct"> | string
    supplier?: StringWithAggregatesFilter<"OtherProduct"> | string
    description?: StringWithAggregatesFilter<"OtherProduct"> | string
    cost?: FloatWithAggregatesFilter<"OtherProduct"> | number
    createdAt?: DateTimeWithAggregatesFilter<"OtherProduct"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"OtherProduct"> | Date | string
  }

  export type SupplierWhereInput = {
    AND?: SupplierWhereInput | SupplierWhereInput[]
    OR?: SupplierWhereInput[]
    NOT?: SupplierWhereInput | SupplierWhereInput[]
    id?: StringFilter<"Supplier"> | string
    name?: StringFilter<"Supplier"> | string
    contactName?: StringNullableFilter<"Supplier"> | string | null
    contactNumber?: StringNullableFilter<"Supplier"> | string | null
    contactEmail?: StringNullableFilter<"Supplier"> | string | null
    createdAt?: DateTimeFilter<"Supplier"> | Date | string
    updatedAt?: DateTimeFilter<"Supplier"> | Date | string
  }

  export type SupplierOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    contactName?: SortOrderInput | SortOrder
    contactNumber?: SortOrderInput | SortOrder
    contactEmail?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SupplierWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: SupplierWhereInput | SupplierWhereInput[]
    OR?: SupplierWhereInput[]
    NOT?: SupplierWhereInput | SupplierWhereInput[]
    contactName?: StringNullableFilter<"Supplier"> | string | null
    contactNumber?: StringNullableFilter<"Supplier"> | string | null
    contactEmail?: StringNullableFilter<"Supplier"> | string | null
    createdAt?: DateTimeFilter<"Supplier"> | Date | string
    updatedAt?: DateTimeFilter<"Supplier"> | Date | string
  }, "id" | "name">

  export type SupplierOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    contactName?: SortOrderInput | SortOrder
    contactNumber?: SortOrderInput | SortOrder
    contactEmail?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SupplierCountOrderByAggregateInput
    _max?: SupplierMaxOrderByAggregateInput
    _min?: SupplierMinOrderByAggregateInput
  }

  export type SupplierScalarWhereWithAggregatesInput = {
    AND?: SupplierScalarWhereWithAggregatesInput | SupplierScalarWhereWithAggregatesInput[]
    OR?: SupplierScalarWhereWithAggregatesInput[]
    NOT?: SupplierScalarWhereWithAggregatesInput | SupplierScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Supplier"> | string
    name?: StringWithAggregatesFilter<"Supplier"> | string
    contactName?: StringNullableWithAggregatesFilter<"Supplier"> | string | null
    contactNumber?: StringNullableWithAggregatesFilter<"Supplier"> | string | null
    contactEmail?: StringNullableWithAggregatesFilter<"Supplier"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Supplier"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Supplier"> | Date | string
  }

  export type ComponentWhereInput = {
    AND?: ComponentWhereInput | ComponentWhereInput[]
    OR?: ComponentWhereInput[]
    NOT?: ComponentWhereInput | ComponentWhereInput[]
    id?: StringFilter<"Component"> | string
    name?: StringFilter<"Component"> | string
    description?: StringFilter<"Component"> | string
    ingredients?: JsonFilter<"Component">
    totalCost?: FloatFilter<"Component"> | number
    hasGluten?: BoolFilter<"Component"> | boolean
    hasDairy?: BoolFilter<"Component"> | boolean
    hasSoy?: BoolFilter<"Component"> | boolean
    hasOnionGarlic?: BoolFilter<"Component"> | boolean
    hasSesame?: BoolFilter<"Component"> | boolean
    hasNuts?: BoolFilter<"Component"> | boolean
    hasEgg?: BoolFilter<"Component"> | boolean
    isVegetarian?: BoolFilter<"Component"> | boolean
    isVegan?: BoolFilter<"Component"> | boolean
    isHalal?: BoolFilter<"Component"> | boolean
    createdAt?: DateTimeFilter<"Component"> | Date | string
    updatedAt?: DateTimeFilter<"Component"> | Date | string
  }

  export type ComponentOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    ingredients?: SortOrder
    totalCost?: SortOrder
    hasGluten?: SortOrder
    hasDairy?: SortOrder
    hasSoy?: SortOrder
    hasOnionGarlic?: SortOrder
    hasSesame?: SortOrder
    hasNuts?: SortOrder
    hasEgg?: SortOrder
    isVegetarian?: SortOrder
    isVegan?: SortOrder
    isHalal?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComponentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: ComponentWhereInput | ComponentWhereInput[]
    OR?: ComponentWhereInput[]
    NOT?: ComponentWhereInput | ComponentWhereInput[]
    description?: StringFilter<"Component"> | string
    ingredients?: JsonFilter<"Component">
    totalCost?: FloatFilter<"Component"> | number
    hasGluten?: BoolFilter<"Component"> | boolean
    hasDairy?: BoolFilter<"Component"> | boolean
    hasSoy?: BoolFilter<"Component"> | boolean
    hasOnionGarlic?: BoolFilter<"Component"> | boolean
    hasSesame?: BoolFilter<"Component"> | boolean
    hasNuts?: BoolFilter<"Component"> | boolean
    hasEgg?: BoolFilter<"Component"> | boolean
    isVegetarian?: BoolFilter<"Component"> | boolean
    isVegan?: BoolFilter<"Component"> | boolean
    isHalal?: BoolFilter<"Component"> | boolean
    createdAt?: DateTimeFilter<"Component"> | Date | string
    updatedAt?: DateTimeFilter<"Component"> | Date | string
  }, "id" | "name">

  export type ComponentOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    ingredients?: SortOrder
    totalCost?: SortOrder
    hasGluten?: SortOrder
    hasDairy?: SortOrder
    hasSoy?: SortOrder
    hasOnionGarlic?: SortOrder
    hasSesame?: SortOrder
    hasNuts?: SortOrder
    hasEgg?: SortOrder
    isVegetarian?: SortOrder
    isVegan?: SortOrder
    isHalal?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ComponentCountOrderByAggregateInput
    _avg?: ComponentAvgOrderByAggregateInput
    _max?: ComponentMaxOrderByAggregateInput
    _min?: ComponentMinOrderByAggregateInput
    _sum?: ComponentSumOrderByAggregateInput
  }

  export type ComponentScalarWhereWithAggregatesInput = {
    AND?: ComponentScalarWhereWithAggregatesInput | ComponentScalarWhereWithAggregatesInput[]
    OR?: ComponentScalarWhereWithAggregatesInput[]
    NOT?: ComponentScalarWhereWithAggregatesInput | ComponentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Component"> | string
    name?: StringWithAggregatesFilter<"Component"> | string
    description?: StringWithAggregatesFilter<"Component"> | string
    ingredients?: JsonWithAggregatesFilter<"Component">
    totalCost?: FloatWithAggregatesFilter<"Component"> | number
    hasGluten?: BoolWithAggregatesFilter<"Component"> | boolean
    hasDairy?: BoolWithAggregatesFilter<"Component"> | boolean
    hasSoy?: BoolWithAggregatesFilter<"Component"> | boolean
    hasOnionGarlic?: BoolWithAggregatesFilter<"Component"> | boolean
    hasSesame?: BoolWithAggregatesFilter<"Component"> | boolean
    hasNuts?: BoolWithAggregatesFilter<"Component"> | boolean
    hasEgg?: BoolWithAggregatesFilter<"Component"> | boolean
    isVegetarian?: BoolWithAggregatesFilter<"Component"> | boolean
    isVegan?: BoolWithAggregatesFilter<"Component"> | boolean
    isHalal?: BoolWithAggregatesFilter<"Component"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Component"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Component"> | Date | string
  }

  export type ProductWhereInput = {
    AND?: ProductWhereInput | ProductWhereInput[]
    OR?: ProductWhereInput[]
    NOT?: ProductWhereInput | ProductWhereInput[]
    id?: StringFilter<"Product"> | string
    name?: StringNullableFilter<"Product"> | string | null
    description?: StringNullableFilter<"Product"> | string | null
    addon?: StringNullableFilter<"Product"> | string | null
    handle?: StringNullableFilter<"Product"> | string | null
    meat1?: StringNullableFilter<"Product"> | string | null
    meat2?: StringNullableFilter<"Product"> | string | null
    option1?: StringNullableFilter<"Product"> | string | null
    option2?: StringNullableFilter<"Product"> | string | null
    serveware?: StringNullableFilter<"Product"> | string | null
    timerA?: IntNullableFilter<"Product"> | number | null
    timerB?: IntNullableFilter<"Product"> | number | null
    skuSearch?: StringNullableFilter<"Product"> | string | null
    variantSku?: StringNullableFilter<"Product"> | string | null
    ingredients?: JsonNullableFilter<"Product">
    totalCost?: FloatFilter<"Product"> | number
    sellingPrice?: FloatNullableFilter<"Product"> | number | null
    realizedMargin?: FloatNullableFilter<"Product"> | number | null
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
  }

  export type ProductOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    addon?: SortOrderInput | SortOrder
    handle?: SortOrderInput | SortOrder
    meat1?: SortOrderInput | SortOrder
    meat2?: SortOrderInput | SortOrder
    option1?: SortOrderInput | SortOrder
    option2?: SortOrderInput | SortOrder
    serveware?: SortOrderInput | SortOrder
    timerA?: SortOrderInput | SortOrder
    timerB?: SortOrderInput | SortOrder
    skuSearch?: SortOrderInput | SortOrder
    variantSku?: SortOrderInput | SortOrder
    ingredients?: SortOrderInput | SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrderInput | SortOrder
    realizedMargin?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ProductWhereInput | ProductWhereInput[]
    OR?: ProductWhereInput[]
    NOT?: ProductWhereInput | ProductWhereInput[]
    name?: StringNullableFilter<"Product"> | string | null
    description?: StringNullableFilter<"Product"> | string | null
    addon?: StringNullableFilter<"Product"> | string | null
    handle?: StringNullableFilter<"Product"> | string | null
    meat1?: StringNullableFilter<"Product"> | string | null
    meat2?: StringNullableFilter<"Product"> | string | null
    option1?: StringNullableFilter<"Product"> | string | null
    option2?: StringNullableFilter<"Product"> | string | null
    serveware?: StringNullableFilter<"Product"> | string | null
    timerA?: IntNullableFilter<"Product"> | number | null
    timerB?: IntNullableFilter<"Product"> | number | null
    skuSearch?: StringNullableFilter<"Product"> | string | null
    variantSku?: StringNullableFilter<"Product"> | string | null
    ingredients?: JsonNullableFilter<"Product">
    totalCost?: FloatFilter<"Product"> | number
    sellingPrice?: FloatNullableFilter<"Product"> | number | null
    realizedMargin?: FloatNullableFilter<"Product"> | number | null
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
  }, "id">

  export type ProductOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    addon?: SortOrderInput | SortOrder
    handle?: SortOrderInput | SortOrder
    meat1?: SortOrderInput | SortOrder
    meat2?: SortOrderInput | SortOrder
    option1?: SortOrderInput | SortOrder
    option2?: SortOrderInput | SortOrder
    serveware?: SortOrderInput | SortOrder
    timerA?: SortOrderInput | SortOrder
    timerB?: SortOrderInput | SortOrder
    skuSearch?: SortOrderInput | SortOrder
    variantSku?: SortOrderInput | SortOrder
    ingredients?: SortOrderInput | SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrderInput | SortOrder
    realizedMargin?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ProductCountOrderByAggregateInput
    _avg?: ProductAvgOrderByAggregateInput
    _max?: ProductMaxOrderByAggregateInput
    _min?: ProductMinOrderByAggregateInput
    _sum?: ProductSumOrderByAggregateInput
  }

  export type ProductScalarWhereWithAggregatesInput = {
    AND?: ProductScalarWhereWithAggregatesInput | ProductScalarWhereWithAggregatesInput[]
    OR?: ProductScalarWhereWithAggregatesInput[]
    NOT?: ProductScalarWhereWithAggregatesInput | ProductScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Product"> | string
    name?: StringNullableWithAggregatesFilter<"Product"> | string | null
    description?: StringNullableWithAggregatesFilter<"Product"> | string | null
    addon?: StringNullableWithAggregatesFilter<"Product"> | string | null
    handle?: StringNullableWithAggregatesFilter<"Product"> | string | null
    meat1?: StringNullableWithAggregatesFilter<"Product"> | string | null
    meat2?: StringNullableWithAggregatesFilter<"Product"> | string | null
    option1?: StringNullableWithAggregatesFilter<"Product"> | string | null
    option2?: StringNullableWithAggregatesFilter<"Product"> | string | null
    serveware?: StringNullableWithAggregatesFilter<"Product"> | string | null
    timerA?: IntNullableWithAggregatesFilter<"Product"> | number | null
    timerB?: IntNullableWithAggregatesFilter<"Product"> | number | null
    skuSearch?: StringNullableWithAggregatesFilter<"Product"> | string | null
    variantSku?: StringNullableWithAggregatesFilter<"Product"> | string | null
    ingredients?: JsonNullableWithAggregatesFilter<"Product">
    totalCost?: FloatWithAggregatesFilter<"Product"> | number
    sellingPrice?: FloatNullableWithAggregatesFilter<"Product"> | number | null
    realizedMargin?: FloatNullableWithAggregatesFilter<"Product"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"Product"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Product"> | Date | string
  }

  export type StaffWhereInput = {
    AND?: StaffWhereInput | StaffWhereInput[]
    OR?: StaffWhereInput[]
    NOT?: StaffWhereInput | StaffWhereInput[]
    id?: StringFilter<"Staff"> | string
    firstName?: StringFilter<"Staff"> | string
    lastName?: StringFilter<"Staff"> | string
    phone?: StringFilter<"Staff"> | string
    email?: StringFilter<"Staff"> | string
    payRate?: FloatFilter<"Staff"> | number
    accessLevel?: StringFilter<"Staff"> | string
    isDriver?: BoolFilter<"Staff"> | boolean
    password?: StringNullableFilter<"Staff"> | string | null
    resetToken?: StringNullableFilter<"Staff"> | string | null
    resetTokenExpiry?: DateTimeNullableFilter<"Staff"> | Date | string | null
    lastLogin?: DateTimeNullableFilter<"Staff"> | Date | string | null
    createdAt?: DateTimeFilter<"Staff"> | Date | string
    updatedAt?: DateTimeFilter<"Staff"> | Date | string
  }

  export type StaffOrderByWithRelationInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    payRate?: SortOrder
    accessLevel?: SortOrder
    isDriver?: SortOrder
    password?: SortOrderInput | SortOrder
    resetToken?: SortOrderInput | SortOrder
    resetTokenExpiry?: SortOrderInput | SortOrder
    lastLogin?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StaffWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    resetToken?: string
    AND?: StaffWhereInput | StaffWhereInput[]
    OR?: StaffWhereInput[]
    NOT?: StaffWhereInput | StaffWhereInput[]
    firstName?: StringFilter<"Staff"> | string
    lastName?: StringFilter<"Staff"> | string
    phone?: StringFilter<"Staff"> | string
    payRate?: FloatFilter<"Staff"> | number
    accessLevel?: StringFilter<"Staff"> | string
    isDriver?: BoolFilter<"Staff"> | boolean
    password?: StringNullableFilter<"Staff"> | string | null
    resetTokenExpiry?: DateTimeNullableFilter<"Staff"> | Date | string | null
    lastLogin?: DateTimeNullableFilter<"Staff"> | Date | string | null
    createdAt?: DateTimeFilter<"Staff"> | Date | string
    updatedAt?: DateTimeFilter<"Staff"> | Date | string
  }, "id" | "email" | "resetToken">

  export type StaffOrderByWithAggregationInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    payRate?: SortOrder
    accessLevel?: SortOrder
    isDriver?: SortOrder
    password?: SortOrderInput | SortOrder
    resetToken?: SortOrderInput | SortOrder
    resetTokenExpiry?: SortOrderInput | SortOrder
    lastLogin?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: StaffCountOrderByAggregateInput
    _avg?: StaffAvgOrderByAggregateInput
    _max?: StaffMaxOrderByAggregateInput
    _min?: StaffMinOrderByAggregateInput
    _sum?: StaffSumOrderByAggregateInput
  }

  export type StaffScalarWhereWithAggregatesInput = {
    AND?: StaffScalarWhereWithAggregatesInput | StaffScalarWhereWithAggregatesInput[]
    OR?: StaffScalarWhereWithAggregatesInput[]
    NOT?: StaffScalarWhereWithAggregatesInput | StaffScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Staff"> | string
    firstName?: StringWithAggregatesFilter<"Staff"> | string
    lastName?: StringWithAggregatesFilter<"Staff"> | string
    phone?: StringWithAggregatesFilter<"Staff"> | string
    email?: StringWithAggregatesFilter<"Staff"> | string
    payRate?: FloatWithAggregatesFilter<"Staff"> | number
    accessLevel?: StringWithAggregatesFilter<"Staff"> | string
    isDriver?: BoolWithAggregatesFilter<"Staff"> | boolean
    password?: StringNullableWithAggregatesFilter<"Staff"> | string | null
    resetToken?: StringNullableWithAggregatesFilter<"Staff"> | string | null
    resetTokenExpiry?: DateTimeNullableWithAggregatesFilter<"Staff"> | Date | string | null
    lastLogin?: DateTimeNullableWithAggregatesFilter<"Staff"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Staff"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Staff"> | Date | string
  }

  export type GilmoursProductCreateInput = {
    id?: string
    sku: string
    brand: string
    description: string
    packSize: string
    uom: string
    price: number
    quantity: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GilmoursProductUncheckedCreateInput = {
    id?: string
    sku: string
    brand: string
    description: string
    packSize: string
    uom: string
    price: number
    quantity: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GilmoursProductUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sku?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GilmoursProductUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sku?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GilmoursProductCreateManyInput = {
    id?: string
    sku: string
    brand: string
    description: string
    packSize: string
    uom: string
    price: number
    quantity: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type GilmoursProductUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    sku?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GilmoursProductUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    sku?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    quantity?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BidfoodProductCreateInput = {
    id?: string
    productCode: string
    brand: string
    description: string
    packSize: string
    ctnQty: string
    uom: string
    qty: number
    lastPricePaid: number
    totalExGST: number
    contains: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BidfoodProductUncheckedCreateInput = {
    id?: string
    productCode: string
    brand: string
    description: string
    packSize: string
    ctnQty: string
    uom: string
    qty: number
    lastPricePaid: number
    totalExGST: number
    contains: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BidfoodProductUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    productCode?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    ctnQty?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    qty?: IntFieldUpdateOperationsInput | number
    lastPricePaid?: FloatFieldUpdateOperationsInput | number
    totalExGST?: FloatFieldUpdateOperationsInput | number
    contains?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BidfoodProductUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    productCode?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    ctnQty?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    qty?: IntFieldUpdateOperationsInput | number
    lastPricePaid?: FloatFieldUpdateOperationsInput | number
    totalExGST?: FloatFieldUpdateOperationsInput | number
    contains?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BidfoodProductCreateManyInput = {
    id?: string
    productCode: string
    brand: string
    description: string
    packSize: string
    ctnQty: string
    uom: string
    qty: number
    lastPricePaid: number
    totalExGST: number
    contains: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BidfoodProductUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    productCode?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    ctnQty?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    qty?: IntFieldUpdateOperationsInput | number
    lastPricePaid?: FloatFieldUpdateOperationsInput | number
    totalExGST?: FloatFieldUpdateOperationsInput | number
    contains?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BidfoodProductUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    productCode?: StringFieldUpdateOperationsInput | string
    brand?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    packSize?: StringFieldUpdateOperationsInput | string
    ctnQty?: StringFieldUpdateOperationsInput | string
    uom?: StringFieldUpdateOperationsInput | string
    qty?: IntFieldUpdateOperationsInput | number
    lastPricePaid?: FloatFieldUpdateOperationsInput | number
    totalExGST?: FloatFieldUpdateOperationsInput | number
    contains?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OtherProductCreateInput = {
    id?: string
    name: string
    supplier: string
    description: string
    cost: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OtherProductUncheckedCreateInput = {
    id?: string
    name: string
    supplier: string
    description: string
    cost: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OtherProductUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    supplier?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    cost?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OtherProductUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    supplier?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    cost?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OtherProductCreateManyInput = {
    id?: string
    name: string
    supplier: string
    description: string
    cost: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OtherProductUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    supplier?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    cost?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OtherProductUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    supplier?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    cost?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierCreateInput = {
    id?: string
    name: string
    contactName?: string | null
    contactNumber?: string | null
    contactEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierUncheckedCreateInput = {
    id?: string
    name: string
    contactName?: string | null
    contactNumber?: string | null
    contactEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactNumber?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactNumber?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierCreateManyInput = {
    id?: string
    name: string
    contactName?: string | null
    contactNumber?: string | null
    contactEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactNumber?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactNumber?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComponentCreateInput = {
    id?: string
    name: string
    description: string
    ingredients: JsonNullValueInput | InputJsonValue
    totalCost: number
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComponentUncheckedCreateInput = {
    id?: string
    name: string
    description: string
    ingredients: JsonNullValueInput | InputJsonValue
    totalCost: number
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComponentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    ingredients?: JsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    hasGluten?: BoolFieldUpdateOperationsInput | boolean
    hasDairy?: BoolFieldUpdateOperationsInput | boolean
    hasSoy?: BoolFieldUpdateOperationsInput | boolean
    hasOnionGarlic?: BoolFieldUpdateOperationsInput | boolean
    hasSesame?: BoolFieldUpdateOperationsInput | boolean
    hasNuts?: BoolFieldUpdateOperationsInput | boolean
    hasEgg?: BoolFieldUpdateOperationsInput | boolean
    isVegetarian?: BoolFieldUpdateOperationsInput | boolean
    isVegan?: BoolFieldUpdateOperationsInput | boolean
    isHalal?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComponentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    ingredients?: JsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    hasGluten?: BoolFieldUpdateOperationsInput | boolean
    hasDairy?: BoolFieldUpdateOperationsInput | boolean
    hasSoy?: BoolFieldUpdateOperationsInput | boolean
    hasOnionGarlic?: BoolFieldUpdateOperationsInput | boolean
    hasSesame?: BoolFieldUpdateOperationsInput | boolean
    hasNuts?: BoolFieldUpdateOperationsInput | boolean
    hasEgg?: BoolFieldUpdateOperationsInput | boolean
    isVegetarian?: BoolFieldUpdateOperationsInput | boolean
    isVegan?: BoolFieldUpdateOperationsInput | boolean
    isHalal?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComponentCreateManyInput = {
    id?: string
    name: string
    description: string
    ingredients: JsonNullValueInput | InputJsonValue
    totalCost: number
    hasGluten?: boolean
    hasDairy?: boolean
    hasSoy?: boolean
    hasOnionGarlic?: boolean
    hasSesame?: boolean
    hasNuts?: boolean
    hasEgg?: boolean
    isVegetarian?: boolean
    isVegan?: boolean
    isHalal?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ComponentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    ingredients?: JsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    hasGluten?: BoolFieldUpdateOperationsInput | boolean
    hasDairy?: BoolFieldUpdateOperationsInput | boolean
    hasSoy?: BoolFieldUpdateOperationsInput | boolean
    hasOnionGarlic?: BoolFieldUpdateOperationsInput | boolean
    hasSesame?: BoolFieldUpdateOperationsInput | boolean
    hasNuts?: BoolFieldUpdateOperationsInput | boolean
    hasEgg?: BoolFieldUpdateOperationsInput | boolean
    isVegetarian?: BoolFieldUpdateOperationsInput | boolean
    isVegan?: BoolFieldUpdateOperationsInput | boolean
    isHalal?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ComponentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    ingredients?: JsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    hasGluten?: BoolFieldUpdateOperationsInput | boolean
    hasDairy?: BoolFieldUpdateOperationsInput | boolean
    hasSoy?: BoolFieldUpdateOperationsInput | boolean
    hasOnionGarlic?: BoolFieldUpdateOperationsInput | boolean
    hasSesame?: BoolFieldUpdateOperationsInput | boolean
    hasNuts?: BoolFieldUpdateOperationsInput | boolean
    hasEgg?: BoolFieldUpdateOperationsInput | boolean
    isVegetarian?: BoolFieldUpdateOperationsInput | boolean
    isVegan?: BoolFieldUpdateOperationsInput | boolean
    isHalal?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductCreateInput = {
    id?: string
    name?: string | null
    description?: string | null
    addon?: string | null
    handle?: string | null
    meat1?: string | null
    meat2?: string | null
    option1?: string | null
    option2?: string | null
    serveware?: string | null
    timerA?: number | null
    timerB?: number | null
    skuSearch?: string | null
    variantSku?: string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: number
    sellingPrice?: number | null
    realizedMargin?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUncheckedCreateInput = {
    id?: string
    name?: string | null
    description?: string | null
    addon?: string | null
    handle?: string | null
    meat1?: string | null
    meat2?: string | null
    option1?: string | null
    option2?: string | null
    serveware?: string | null
    timerA?: number | null
    timerB?: number | null
    skuSearch?: string | null
    variantSku?: string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: number
    sellingPrice?: number | null
    realizedMargin?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    addon?: NullableStringFieldUpdateOperationsInput | string | null
    handle?: NullableStringFieldUpdateOperationsInput | string | null
    meat1?: NullableStringFieldUpdateOperationsInput | string | null
    meat2?: NullableStringFieldUpdateOperationsInput | string | null
    option1?: NullableStringFieldUpdateOperationsInput | string | null
    option2?: NullableStringFieldUpdateOperationsInput | string | null
    serveware?: NullableStringFieldUpdateOperationsInput | string | null
    timerA?: NullableIntFieldUpdateOperationsInput | number | null
    timerB?: NullableIntFieldUpdateOperationsInput | number | null
    skuSearch?: NullableStringFieldUpdateOperationsInput | string | null
    variantSku?: NullableStringFieldUpdateOperationsInput | string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    sellingPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    realizedMargin?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    addon?: NullableStringFieldUpdateOperationsInput | string | null
    handle?: NullableStringFieldUpdateOperationsInput | string | null
    meat1?: NullableStringFieldUpdateOperationsInput | string | null
    meat2?: NullableStringFieldUpdateOperationsInput | string | null
    option1?: NullableStringFieldUpdateOperationsInput | string | null
    option2?: NullableStringFieldUpdateOperationsInput | string | null
    serveware?: NullableStringFieldUpdateOperationsInput | string | null
    timerA?: NullableIntFieldUpdateOperationsInput | number | null
    timerB?: NullableIntFieldUpdateOperationsInput | number | null
    skuSearch?: NullableStringFieldUpdateOperationsInput | string | null
    variantSku?: NullableStringFieldUpdateOperationsInput | string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    sellingPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    realizedMargin?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductCreateManyInput = {
    id?: string
    name?: string | null
    description?: string | null
    addon?: string | null
    handle?: string | null
    meat1?: string | null
    meat2?: string | null
    option1?: string | null
    option2?: string | null
    serveware?: string | null
    timerA?: number | null
    timerB?: number | null
    skuSearch?: string | null
    variantSku?: string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: number
    sellingPrice?: number | null
    realizedMargin?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    addon?: NullableStringFieldUpdateOperationsInput | string | null
    handle?: NullableStringFieldUpdateOperationsInput | string | null
    meat1?: NullableStringFieldUpdateOperationsInput | string | null
    meat2?: NullableStringFieldUpdateOperationsInput | string | null
    option1?: NullableStringFieldUpdateOperationsInput | string | null
    option2?: NullableStringFieldUpdateOperationsInput | string | null
    serveware?: NullableStringFieldUpdateOperationsInput | string | null
    timerA?: NullableIntFieldUpdateOperationsInput | number | null
    timerB?: NullableIntFieldUpdateOperationsInput | number | null
    skuSearch?: NullableStringFieldUpdateOperationsInput | string | null
    variantSku?: NullableStringFieldUpdateOperationsInput | string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    sellingPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    realizedMargin?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    addon?: NullableStringFieldUpdateOperationsInput | string | null
    handle?: NullableStringFieldUpdateOperationsInput | string | null
    meat1?: NullableStringFieldUpdateOperationsInput | string | null
    meat2?: NullableStringFieldUpdateOperationsInput | string | null
    option1?: NullableStringFieldUpdateOperationsInput | string | null
    option2?: NullableStringFieldUpdateOperationsInput | string | null
    serveware?: NullableStringFieldUpdateOperationsInput | string | null
    timerA?: NullableIntFieldUpdateOperationsInput | number | null
    timerB?: NullableIntFieldUpdateOperationsInput | number | null
    skuSearch?: NullableStringFieldUpdateOperationsInput | string | null
    variantSku?: NullableStringFieldUpdateOperationsInput | string | null
    ingredients?: NullableJsonNullValueInput | InputJsonValue
    totalCost?: FloatFieldUpdateOperationsInput | number
    sellingPrice?: NullableFloatFieldUpdateOperationsInput | number | null
    realizedMargin?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StaffCreateInput = {
    id?: string
    firstName: string
    lastName: string
    phone: string
    email: string
    payRate: number
    accessLevel: string
    isDriver?: boolean
    password?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    lastLogin?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StaffUncheckedCreateInput = {
    id?: string
    firstName: string
    lastName: string
    phone: string
    email: string
    payRate: number
    accessLevel: string
    isDriver?: boolean
    password?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    lastLogin?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StaffUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    phone?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    payRate?: FloatFieldUpdateOperationsInput | number
    accessLevel?: StringFieldUpdateOperationsInput | string
    isDriver?: BoolFieldUpdateOperationsInput | boolean
    password?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StaffUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    phone?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    payRate?: FloatFieldUpdateOperationsInput | number
    accessLevel?: StringFieldUpdateOperationsInput | string
    isDriver?: BoolFieldUpdateOperationsInput | boolean
    password?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StaffCreateManyInput = {
    id?: string
    firstName: string
    lastName: string
    phone: string
    email: string
    payRate: number
    accessLevel: string
    isDriver?: boolean
    password?: string | null
    resetToken?: string | null
    resetTokenExpiry?: Date | string | null
    lastLogin?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type StaffUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    phone?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    payRate?: FloatFieldUpdateOperationsInput | number
    accessLevel?: StringFieldUpdateOperationsInput | string
    isDriver?: BoolFieldUpdateOperationsInput | boolean
    password?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StaffUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    firstName?: StringFieldUpdateOperationsInput | string
    lastName?: StringFieldUpdateOperationsInput | string
    phone?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    payRate?: FloatFieldUpdateOperationsInput | number
    accessLevel?: StringFieldUpdateOperationsInput | string
    isDriver?: BoolFieldUpdateOperationsInput | boolean
    password?: NullableStringFieldUpdateOperationsInput | string | null
    resetToken?: NullableStringFieldUpdateOperationsInput | string | null
    resetTokenExpiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLogin?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type GilmoursProductCountOrderByAggregateInput = {
    id?: SortOrder
    sku?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    uom?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GilmoursProductAvgOrderByAggregateInput = {
    price?: SortOrder
    quantity?: SortOrder
  }

  export type GilmoursProductMaxOrderByAggregateInput = {
    id?: SortOrder
    sku?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    uom?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GilmoursProductMinOrderByAggregateInput = {
    id?: SortOrder
    sku?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    uom?: SortOrder
    price?: SortOrder
    quantity?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GilmoursProductSumOrderByAggregateInput = {
    price?: SortOrder
    quantity?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BidfoodProductCountOrderByAggregateInput = {
    id?: SortOrder
    productCode?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    ctnQty?: SortOrder
    uom?: SortOrder
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
    contains?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BidfoodProductAvgOrderByAggregateInput = {
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
  }

  export type BidfoodProductMaxOrderByAggregateInput = {
    id?: SortOrder
    productCode?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    ctnQty?: SortOrder
    uom?: SortOrder
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
    contains?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BidfoodProductMinOrderByAggregateInput = {
    id?: SortOrder
    productCode?: SortOrder
    brand?: SortOrder
    description?: SortOrder
    packSize?: SortOrder
    ctnQty?: SortOrder
    uom?: SortOrder
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
    contains?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BidfoodProductSumOrderByAggregateInput = {
    qty?: SortOrder
    lastPricePaid?: SortOrder
    totalExGST?: SortOrder
  }

  export type OtherProductCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    supplier?: SortOrder
    description?: SortOrder
    cost?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OtherProductAvgOrderByAggregateInput = {
    cost?: SortOrder
  }

  export type OtherProductMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    supplier?: SortOrder
    description?: SortOrder
    cost?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OtherProductMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    supplier?: SortOrder
    description?: SortOrder
    cost?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OtherProductSumOrderByAggregateInput = {
    cost?: SortOrder
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type SupplierCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    contactName?: SortOrder
    contactNumber?: SortOrder
    contactEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SupplierMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    contactName?: SortOrder
    contactNumber?: SortOrder
    contactEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SupplierMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    contactName?: SortOrder
    contactNumber?: SortOrder
    contactEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type ComponentCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    ingredients?: SortOrder
    totalCost?: SortOrder
    hasGluten?: SortOrder
    hasDairy?: SortOrder
    hasSoy?: SortOrder
    hasOnionGarlic?: SortOrder
    hasSesame?: SortOrder
    hasNuts?: SortOrder
    hasEgg?: SortOrder
    isVegetarian?: SortOrder
    isVegan?: SortOrder
    isHalal?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComponentAvgOrderByAggregateInput = {
    totalCost?: SortOrder
  }

  export type ComponentMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    totalCost?: SortOrder
    hasGluten?: SortOrder
    hasDairy?: SortOrder
    hasSoy?: SortOrder
    hasOnionGarlic?: SortOrder
    hasSesame?: SortOrder
    hasNuts?: SortOrder
    hasEgg?: SortOrder
    isVegetarian?: SortOrder
    isVegan?: SortOrder
    isHalal?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComponentMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    totalCost?: SortOrder
    hasGluten?: SortOrder
    hasDairy?: SortOrder
    hasSoy?: SortOrder
    hasOnionGarlic?: SortOrder
    hasSesame?: SortOrder
    hasNuts?: SortOrder
    hasEgg?: SortOrder
    isVegetarian?: SortOrder
    isVegan?: SortOrder
    isHalal?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ComponentSumOrderByAggregateInput = {
    totalCost?: SortOrder
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type ProductCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    addon?: SortOrder
    handle?: SortOrder
    meat1?: SortOrder
    meat2?: SortOrder
    option1?: SortOrder
    option2?: SortOrder
    serveware?: SortOrder
    timerA?: SortOrder
    timerB?: SortOrder
    skuSearch?: SortOrder
    variantSku?: SortOrder
    ingredients?: SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrder
    realizedMargin?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductAvgOrderByAggregateInput = {
    timerA?: SortOrder
    timerB?: SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrder
    realizedMargin?: SortOrder
  }

  export type ProductMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    addon?: SortOrder
    handle?: SortOrder
    meat1?: SortOrder
    meat2?: SortOrder
    option1?: SortOrder
    option2?: SortOrder
    serveware?: SortOrder
    timerA?: SortOrder
    timerB?: SortOrder
    skuSearch?: SortOrder
    variantSku?: SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrder
    realizedMargin?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    addon?: SortOrder
    handle?: SortOrder
    meat1?: SortOrder
    meat2?: SortOrder
    option1?: SortOrder
    option2?: SortOrder
    serveware?: SortOrder
    timerA?: SortOrder
    timerB?: SortOrder
    skuSearch?: SortOrder
    variantSku?: SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrder
    realizedMargin?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductSumOrderByAggregateInput = {
    timerA?: SortOrder
    timerB?: SortOrder
    totalCost?: SortOrder
    sellingPrice?: SortOrder
    realizedMargin?: SortOrder
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type StaffCountOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    payRate?: SortOrder
    accessLevel?: SortOrder
    isDriver?: SortOrder
    password?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
    lastLogin?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StaffAvgOrderByAggregateInput = {
    payRate?: SortOrder
  }

  export type StaffMaxOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    payRate?: SortOrder
    accessLevel?: SortOrder
    isDriver?: SortOrder
    password?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
    lastLogin?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StaffMinOrderByAggregateInput = {
    id?: SortOrder
    firstName?: SortOrder
    lastName?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    payRate?: SortOrder
    accessLevel?: SortOrder
    isDriver?: SortOrder
    password?: SortOrder
    resetToken?: SortOrder
    resetTokenExpiry?: SortOrder
    lastLogin?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StaffSumOrderByAggregateInput = {
    payRate?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[]
    notIn?: string[]
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[]
    notIn?: number[]
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[]
    notIn?: Date[] | string[]
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | null
    notIn?: string[] | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | null
    notIn?: number[] | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | null
    notIn?: Date[] | string[] | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}