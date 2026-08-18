/**
 * `@age/sign-in-directory` — ADR-0079 slice 3, **the admission decision.**
 *
 * 🚫 It opens no database, mints nothing and reads no clock. The rows arrive as
 * parameters, and whether they admit anybody is decided here where it can be
 * tested against every shape a directory can be in.
 *
 * 🛑 **AGE MINTS NOTHING.** A verified Google identity with no row here is
 * refused, and there is no path in this package that could create one.
 */

export {
  decideSignIn,
  type AdmittedOperator,
  type DirectoryAccount,
  type DirectoryEntry,
  type DirectoryMembership,
  type SignInDecision,
  type SignInRefusalReason,
} from './sign-in-decision';
