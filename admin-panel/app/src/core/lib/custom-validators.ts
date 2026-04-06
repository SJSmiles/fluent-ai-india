import { AbstractControl, ValidatorFn } from '@angular/forms';

/* eslint-disable no-underscore-dangle */
export class CustomValidators {
  public static getValidatorErrorMessage(validatorName: string, validatorValue?: any): string {
    let config: { [k: string]: any } = {};
    config = {
      requiredField: 'VALIDATION.REQUIRED_FIELD',
      required: 'VALIDATION.REQUIRED',
      maxlength: `VALIDATION.MAXLENGTH,${validatorValue?.requiredLength}`,
      minlength: `VALIDATION.MINLENGTH,${validatorValue?.requiredLength}`,
      validLocation: 'VALIDATION.VALID_LOCATION',
      noAtSymbol: 'VALIDATION.NO_AT_SYMBOL',
      invalidDomainName: 'VALIDATION.INVALID_DOMAIN',
      invalidHourlyRate: 'VALIDATION.INVALID_HOURLY_RATE',
      atLeastOneRequired: 'VALIDATION.AT_LEAST_ONE_REQUIRED',
      invalidWhatsappNumber: 'VALIDATION.INVALID_WHATSAPP',
      invalidEmail: 'VALIDATION.INVALID_EMAIL',
      invalidFullEmail: 'VALIDATION.INVALID_FULL_EMAIL',
      invalidGreaterThanZeroInput: 'VALIDATION.GREATER_THAN_ZERO',
      invalidWorkingRadius: 'VALIDATION.INVALID_WORKING_RADIUS',
      invalidBankName: 'VALIDATION.INVALID_BANK_NAME',
      invalidCharacters: 'VALIDATION.INVALID_CHARACTERS',
      twitterValidator: 'VALIDATION.INVALID_TWITTER',
      linkedInValidator: 'VALIDATION.INVALID_LINKEDIN',
      linkValidator: 'VALIDATION.INVALID_LINK',
      invalidAlphaSpace: 'VALIDATION.INVALID_ALPHA_SPACE',
      invalidAlphanumericInput: 'VALIDATION.INVALID_ALPHANUMERIC',
      invalidWebsiteLink: 'VALIDATION.INVALID_WEBSITE',
      invalidFirstLetter: 'VALIDATION.INVALID_FIRST_LETTER',
      urlValidator: 'VALIDATION.INVALID_SOCIAL_MEDIA',
      maxNumberLength: `VALIDATION.MAX_NUMBER_LENGTH,${validatorValue?.maxLength}`,
      minNumberLength: `VALIDATION.MIN_NUMBER_LENGTH,${validatorValue?.minLength}`,
      isValidRating: 'VALIDATION.INVALID_RATING',
      isValidConsent: 'VALIDATION.INVALID_CONSENT',
      pattern: 'VALIDATION.PHONE_PATTERN',
      min: `VALIDATION.MIN,${validatorValue?.min}`,
      max: `VALIDATION.MAX,${validatorValue?.max}`,
      invalidEmailLocalPart: 'VALIDATION.INVALID_EMAIL',
      invalidPhoneNumber: 'VALIDATION.INVALID_PHONE',
      passwordStrength: 'VALIDATION.PASSWORD_STRENGTH',
      passwordMismatch: 'VALIDATION.PASSWORD_MISMATCH',
      whiteSpace: 'VALIDATION.WHITESPACE',
      invalidIntegerOnly: 'VALIDATION.INVALID_INTEGER_ONLY'
    };
    return config[validatorName];
  }

  public static requiredValidator(control: { value: string | any[] | null | undefined }): any {
    if (
      control.value === undefined ||
      control.value === null ||
      control.value === '' ||
      control.value.length === 0
    ) {
      return { requiredField: true };
    } else {
      return null;
    }
  }

  // required validation for option
  public static required(control: { value: string | any[] | null | undefined }): any {
    if (
      control.value === undefined ||
      control.value === null ||
      control.value === '' ||
      control.value.length === 0
    ) {
      return { required: true };
    } else {
      return null;
    }
  }

  public static dateFormatValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;

      // Allow empty values — no "required" logic here
      if (!value) {
        return null;
      }

      // Validate format: YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (!dateRegex.test(value)) {
        return { invalidDateFormat: true };
      }

      return null;
    };
  }

  static atLeastOneSelected(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;
      return value && value.length > 0 ? null : { atLeastOneRequired: true };
    };
  }

  public static requiredWithTrim(control: { value: string }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return { required: true };
    } else {
      control.value = control.value.trim();
      if (control.value === '') {
        return { required: true };
      }
      return null;
    }
  }

  static optionalWithTrim(control: { value: string }): any {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null; // Allow empty
    }
    if (typeof value === 'string' && value.trim() === '') {
      return { whiteSpace: true }; // Reject whitespace-only
    }
    return null;
  }

  public static textWithTrim(control: { value: any }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    } else {
      control.value = control.value.trim();
      if (control.value === '') {
        control.value = null;
      }
      return null;
    }
  }

  // required validation for option
  public static validLocation(control: { value: string | any[] | null | undefined }): any {
    if (
      control.value === undefined ||
      control.value === null ||
      control.value === '' ||
      control.value.length === 0
    ) {
      return { validLocation: true };
    } else {
      return null;
    }
  }

  // Domain Validator
  public static domainValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    // Check if domain length exceeds 253 characters (RFC standard)
    if (control.value.length > 253) {
      return { invalidDomainName: true };
    }

    // Updated regex pattern for domain validation - allows labels up to 70 characters
    if (
      control.value.match(
        /^(?!\-)(?!.*\-\-)[A-Za-z0-9\-]{1,70}(?<!\-)\.(?!-)([A-Za-z0-9\-]{1,70}\.?)+$/
      )
    ) {
      return null;
    } else {
      return { invalidDomainName: true };
    }
  }

  public static emailValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }
    const emailRegex =
      /^[a-zA-Z0-9](?!.*[.]{2})[a-zA-Z0-9._%+-]*[a-zA-Z0-9]@[a-zA-Z0-9](?!.*[-]{2})[a-zA-Z0-9-]*(?<!-)(?:\.[a-zA-Z0-9-]+)*(?<!-)\.[a-zA-Z]{2,}$/;
    if (!control.value.match(emailRegex)) {
      return { invalidEmail: true };
    } else {
      return null;
    }
  }

  public static whatsappNumberValidator(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) {
      return null;
    }

    const whatsappNumberPattern = /^\+?[1-9]\d{9,14}$/;
    const isValid = whatsappNumberPattern.test(control.value);
    return isValid ? null : { invalidWhatsappNumber: true };
  }

  static fullEmailValidator(domain: string): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const emailPart = control.value;
      if (!emailPart) {
        return null;
      }
      const fullDomain = domain.startsWith('@') ? domain : `@${domain}`;

      const fullEmail = `${emailPart}${fullDomain}`;

      const strictRegex = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      const enhancedRegex =
        /^(?!.*\.\.)(?!.*--)(?!.*[-._%+]{2})[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!strictRegex.test(fullEmail)) {
        return { invalidFullEmail: true };
      }

      if (!enhancedRegex.test(fullEmail)) {
        return { invalidFullEmail: true };
      }
      return null;
    };
  }

  static validHourlyRate(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;
      const isValidNumber = typeof value === 'number' && value > 0;
      const isNotZero = value !== '00';
      return isValidNumber && isNotZero ? null : { invalidHourlyRate: true };
    };
  }

  static noAtSymbolValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value: string = control.value || '';
      const hasAtSymbol = value.includes('@');
      return hasAtSymbol ? { noAtSymbol: { value: control.value } } : null;
    };
  }

  public static invalidGreaterThanZeroInput(control: { value: number }): any {
    if (control.value < 1) {
      return { invalidGreaterThanZeroInput: true };
    } else {
      return null;
    }
  }

  public static invalidWorkingRadius(control: { value: number }): any {
    if (control.value < 1 || control.value > 999) {
      return { invalidWorkingRadius: true };
    } else {
      return null;
    }
  }

  public static invalidBankName(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }
    if (!control.value.match(/^[A-Za-z0-9\s&.'-]{1,}$/)) {
      return { invalidBankName: true };
    } else {
      return null;
    }
  }

  public static invalidCharacters(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }
    if (!control.value.match(/^[A-Za-z\s.'-]{1,}$/)) {
      return { invalidCharacters: true };
    } else {
      return null;
    }
  }

  public static twitterValidator(control: { value: string | null | undefined }): any {
    const twitterUrlRegex =
      /^https?:\/\/(?:www\.)?twitter\.com(?:\/(\w+)(?:\/status\/(\d+))?)?(\?.*)?$/;
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }
    if (!control.value.match(twitterUrlRegex)) {
      return { twitterValidator: true };
    } else {
      return null;
    }
  }

  public static linkedInValidator(control: { value: string | null | undefined }): any {
    const linkedInRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9_-]+\/?$/;
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }
    if (!control.value.match(linkedInRegex)) {
      return { linkedInValidator: true };
    } else {
      return null;
    }
  }
  public static linkValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }
    try {
      new URL(control.value);
      return null;
    } catch (err) {
      return { linkValidator: true };
    }
  }

  public static alphaSpaceValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    const alphaSpaceRegex = /^[a-zA-Z\s]+$/;

    if (alphaSpaceRegex.test(control.value)) {
      return null;
    } else {
      return { invalidAlphaSpace: true };
    }
  }

  public static alphanumericSpaceValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    // Regular expression to match only alphanumeric characters and spaces
    const alphanumericSpaceRegex = /^[a-zA-Z0-9\s]+$/;

    if (alphanumericSpaceRegex.test(control.value)) {
      return null; // Valid input
    } else {
      return { invalidAlphanumericInput: true }; // Invalid input
    }
  }

  public static emailLocalPartValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    // Email local part validation rules:
    // 1. Must contain at least one letter
    // 2. Can contain letters, numbers, dots, hyphens, and underscores
    // 3. Cannot start or end with special characters (., -, _)
    // 4. Cannot have consecutive special characters
    // 5. Must be 1-64 characters long

    const value = control.value.trim();

    // Check length (RFC 5321 specifies max 64 characters for local part)
    if (value.length === 0 || value.length > 64) {
      return { invalidEmailLocalPart: true };
    }

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(value)) {
      return { invalidEmailLocalPart: true };
    }

    // Cannot start or end with special characters
    if (/^[._-]|[._-]$/.test(value)) {
      return { invalidEmailLocalPart: true };
    }

    // Cannot have consecutive special characters
    if (/[._-]{2,}/.test(value)) {
      return { invalidEmailLocalPart: true };
    }

    // Only allow letters, numbers, and specific special characters
    const emailLocalPartRegex = /^[a-zA-Z0-9._-]+$/;

    if (emailLocalPartRegex.test(value)) {
      return null; // Valid input
    } else {
      return { invalidEmailLocalPart: true }; // Invalid input
    }
  }

  public static phoneNumberValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    // Regex for phone number with country code allowing +, -, (, ), spaces
    const phoneNumberRegex = /^\+[1-9]\d{0,2}[\s\-\(\)]*[\d\s\-\(\)]{7,20}$/;

    if (phoneNumberRegex.test(control.value)) {
      // Extract only digits (excluding the + and country code digits)
      const allDigits = control.value.replace(/\D/g, ''); // Remove all non-digits
      const phoneDigits = allDigits.substring(1); // Remove country code part

      // Check if phone number part has 7-15 digits
      if (phoneDigits.length >= 8 && phoneDigits.length <= 18) {
        // 1-3 country + 7-15 phone = 8-18 total
        return null; // Valid input
      }
    }

    return { invalidPhoneNumber: true }; // Invalid input
  }

  public static alphanumericValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    // Regular expression to match only alphanumeric characters (no spaces)
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;

    if (alphanumericRegex.test(control.value)) {
      return null; // Valid input
    } else {
      return { invalidAlphanumericInput: true }; // Invalid input
    }
  }

  public static maxNumberLength(maxLength: number): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      if (control.value != null) {
        const value = control.value.toString();
        if (value.length > maxLength) {
          return { maxNumberLength: { maxLength } };
        }
      }
      return null;
    };
  }

  public static minNumberLength(minLength: number): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      if (control.value != null) {
        const value = control.value.toString();
        if (value.length < minLength) {
          return { minNumberLength: { minLength } };
        }
      }
      return null;
    };
  }

  public static urlValidator(control: { value: string | null | undefined }): any {
    const socialMediaUrlRegex = {
      facebook:
        /^https?:\/\/(?:www\.)?facebook\.com\/(?:[^/]+\/)?(?:[^/]+\/)?(?:[^/]+\/)?([a-zA-Z0-9.]+)(?:\/)?(?:\?([^&]+))?$/,
      twitter: /^(https?:\/\/)?(?:www\.)?twitter\.(com|in)\/.*/,
      instagram:
        /^https?:\/\/(?:www\.)?instagram\.com\/(?:.*\/)?([a-zA-Z0-9._]+)(?:\/)?(?:\?([^&]+))?$/,
      linkedIn: /^(https?:\/\/)?(www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9_-]+\/?$/,
      youTube:
        /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/]+\/)?(?:[^/]+\/)?(?:watch\?(?:[^&]+&)?v=([a-zA-Z0-9_-]+)|[^/]+)|youtu\.be\/([a-zA-Z0-9_-]+))(?:\?.*)?$/,
      pinterest: /^(https?:\/\/)?(?:www\.)?pinterest\.(com|in)\/.*/,
      snapchat: /^(https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.(com|in)(?:\/.*)?$/,
      tikTok:
        /^https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_]+)(?:\/video\/(\d+))?(?:\?([^&]+))?$/,
      whatsApp: /^https?:\/\/(?:www\.)?whatsapp\.com\/(?:.*\/)?(?:[0-9]+)(?:\?([^&]+))?$/,
      weChat: /^(https?:\/\/)?(?:www\.)?weixin\.qq\.com(?:\.in)?\//,
      telegram: /^(https?:\/\/)?(?:t\.me|telegram\.me)\/.*$/,
      reddit: /^(https?:\/\/)?(?:www\.)?reddit\.(?:com|in)\//,
      tumblr: /^(https?:\/\/)?(?:www\.)?tumblr\.(com|in)\/.*/,
      flickr: /^(https?:\/\/)?(?:www\.)?flickr\.(?:com|in)\//,
      vimeo:
        /^https?:\/\/(?:www\.)?vimeo\.com\/(?:channels\/[a-zA-Z0-9-_.]+\/)?([a-zA-Z0-9_]+)(?:\/)?(?:\?([^&]+))?$/,
      soundCloud: /^(https?:\/\/)?(?:www\.)?soundcloud\.(?:com|in)\//,
      spotify: /^(https?:\/\/)?(?:www\.)?(open\.spotify\.com|play\.spotify\.com|spoti\.fi)\//,

      twitch: /^https?:\/\/(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)(?:\?([^&]+))?$/,
      medium: /^(https?:\/\/)?(?:www\.)?medium\.(?:com|in)\//,
      quora: /^(https?:\/\/)?(?:www\.)?quora\.(?:com|in)\//
    };
    if (!control || control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    const regexArray = Object.values(socialMediaUrlRegex);
    const isMatched = regexArray.some((regex) => (control.value ?? '').match(regex));

    if (!isMatched) {
      return { urlValidator: true };
    } else {
      return null;
    }
  }

  public static validateRatingRange(control: AbstractControl): { [key: string]: any } | null {
    // First check if the input matches the pattern of a valid decimal number with at most one decimal point
    const validFormatRegex = /^[1-5](\.\d+)?$/;
    if (!validFormatRegex.test(control.value)) {
      return { isValidRating: true };
    }

    // Then check if the parsed value is within the valid range
    const value = parseFloat(control.value);
    if (value < 1 || value > 5) {
      return { isValidRating: true };
    }

    return null;
  }

  public static validateConsentRange(control: AbstractControl): { [key: string]: any } | null {
    const value = parseFloat(control.value);
    if (isNaN(value) || value < 0 || value > 1) {
      return { isValidConsent: true };
    }
    return null;
  }

  public static invalidWebsiteLinkValidator(control: { value: string | null | undefined }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    const url = control.value.trim();

    // Regex that REQUIRES http:// or https:// at the beginning
    const websiteRegex =
      /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(\/.*)?$/;

    if (websiteRegex.test(url)) {
      return null; // Valid website URL
    } else {
      return { invalidWebsiteLink: true }; // Invalid website URL
    }
  }

  public static passwordStrengthValidator(control: { value: string | null | undefined }): any {
    if (!control.value || control.value.trim() === '') {
      return null;
    }

    const password = control.value.trim();
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]).{8,}$/;

    return passwordRegex.test(password) ? null : { passwordStrength: true };
  }

  public static passwordMatch(control: AbstractControl): any {
    if (!control.parent) {
      return null;
    }

    const password = control.parent.get('password');
    const confirmPassword = control;

    if (!confirmPassword.value || confirmPassword.value.trim() === '') {
      return { required: true };
    }

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }

    return null;
  }

  public static integerOnlyValidator(control: { value: any }): any {
    if (control.value === undefined || control.value === null || control.value === '') {
      return null;
    }

    const value = control.value.toString().trim();

    // Check if value contains decimal point or is not a valid integer
    if (value.includes('.') || value.includes(',')) {
      return { invalidIntegerOnly: true };
    }

    // Check if it's a valid number
    const numValue = Number(value);
    if (isNaN(numValue) || !Number.isInteger(numValue) || numValue < 1) {
      return { invalidIntegerOnly: true };
    }

    // Regex to match only positive integers
    const integerRegex = /^\d+$/;

    if (integerRegex.test(value) && numValue >= 1) {
      return null; // Valid integer
    } else {
      return { invalidIntegerOnly: true }; // Invalid input
    }
  }
}
