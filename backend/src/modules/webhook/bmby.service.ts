import Logger from "../../logger/logger";
import { purchaseReadinessMapper } from "./helper/purchaseReadinessMapper";

interface BmbyUser {
  fullName: string;
  email: string;
  phoneNumber: string;
  region: string;
  gender?: string;
  additionalInformation?: Record<string, any>;
  purchase_readiness?: string;
  [key: string]: any;
}

interface BmbyResponse {
  success: boolean;
  bmbyId?: string;
  error?: string;
  data?: any;
  isExisting?: boolean;
}

interface BmbyCredentials {
  username: string;
  password: string;
  projectId: string;
  userId: string;
}

class BmbyService {
  private defaultCredentials: BmbyCredentials;
  private soapUrl: string = "https://www.bmby.com/WebServices/srv/v3/";

  constructor() {
    this.defaultCredentials = {
      username: process.env.BMBY_USERNAME || "",
      password: process.env.BMBY_PASSWORD || "",
      projectId: "",
      userId: "",
    };

    if (!this.defaultCredentials.username || !this.defaultCredentials.password) {
      Logger.error("BMBY username/password missing in environment variables");
    }
  }

  /**
  * Search for existing user in BMBY by email
  */
  async findExistingUserByEmail(
    email: string,
    userCredentials: { projectId: string; userId: string }
  ): Promise<string | null> {
    try {
      const credentials: BmbyCredentials = {
        username: this.defaultCredentials.username,
        password: this.defaultCredentials.password,
        projectId: userCredentials.projectId,
        userId: userCredentials.userId,
      };

      Logger.info("Searching for existing BMBY user by email:", { email });

      const soapEnvelope = this.createGetAllByEmailSoapEnvelope(email, credentials);
      const response = await fetch(this.soapUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://www.bmby.com/WebServices/srv/v3/GetAll",
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        Logger.error(`BMBY GetAll HTTP error ${response.status}: ${response.statusText}`);
        return null;
      }

      const result = await response.text();
      Logger.info("BMBY GetAll Response (Email search):", result.substring(0, 500));

      // ✅ PASS EMAIL TO VERIFY THE MATCH
      const clientId = this.parseGetAllResponse(result, email, undefined);

      if (clientId) {
        Logger.info("✓ Found existing BMBY user by email:", { clientId, email });
        return clientId;
      }

      Logger.info("✗ No existing BMBY user found for email:", email);
      return null;
    } catch (error: any) {
      Logger.error("Error searching for existing BMBY user by email:", error);
      return null;
    }
  }

  /**
   * Search for existing user in BMBY by phone
   */
  async findExistingUserByPhone(
    phoneNumber: string,
    userCredentials: { projectId: string; userId: string }
  ): Promise<string | null> {
    try {
      const credentials: BmbyCredentials = {
        username: this.defaultCredentials.username,
        password: this.defaultCredentials.password,
        projectId: userCredentials.projectId,
        userId: userCredentials.userId,
      };

      Logger.info("Searching for existing BMBY user by phone:", { phoneNumber });

      const soapEnvelope = this.createGetAllByPhoneSoapEnvelope(phoneNumber, credentials);
      const response = await fetch(this.soapUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://www.bmby.com/WebServices/srv/v3/GetAll",
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        Logger.error(`BMBY GetAll HTTP error ${response.status}: ${response.statusText}`);
        return null;
      }

      const result = await response.text();
      Logger.info("BMBY GetAll Response (Phone search):", result.substring(0, 500));

      // ✅ PASS PHONE TO VERIFY THE MATCH
      const clientId = this.parseGetAllResponse(result, undefined, phoneNumber);

      if (clientId) {
        Logger.info("✓ Found existing BMBY user by phone:", { clientId, phoneNumber });
        return clientId;
      }

      Logger.info("✗ No existing BMBY user found for phone:", phoneNumber);
      return null;
    } catch (error: any) {
      Logger.error("Error searching for existing BMBY user by phone:", error);
      return null;
    }
  }

  /**
   * Search for existing user by email first, then phone
   */
  async findExistingUser(
    email: string,
    phoneNumber: string,
    userCredentials: { projectId: string; userId: string }
  ): Promise<string | null> {
    // Try email first
    let clientId = await this.findExistingUserByEmail(email, userCredentials);
    if (clientId) return clientId;

    // If not found by email, try phone
    clientId = await this.findExistingUserByPhone(phoneNumber, userCredentials);
    return clientId;
  }

  /**
   * Create or update user in BMBY
   * First checks if user exists, then creates or updates accordingly
   */
  async createOrUpdateUser(
    userData: BmbyUser,
    userCredentials: { projectId: string; userId: string }
  ): Promise<BmbyResponse> {
    try {
      const credentials: BmbyCredentials = {
        username: this.defaultCredentials.username,
        password: this.defaultCredentials.password,
        projectId: userCredentials.projectId,
        userId: userCredentials.userId,
      };

      if (!this.validateCredentials(credentials)) {
        return {
          success: false,
          error: "Invalid BMBY credentials - username, password, projectId and userId are all required",
        };
      }

      Logger.info("=== Starting createOrUpdateUser ===", {
        email: userData.email,
        phone: userData.phoneNumber,
      });

      // First, check if user already exists
      const existingClientId = await this.findExistingUser(
        userData.email,
        userData.phoneNumber,
        userCredentials
      );

      if (existingClientId) {
        Logger.info("User already exists in BMBY, updating:", {
          email: userData.email,
          clientId: existingClientId,
        });

        // Update existing user
        const updateResult = await this.updateUser(userData, existingClientId, userCredentials);

        if (updateResult.success) {
          return {
            success: true,
            bmbyId: existingClientId,
            isExisting: true,
            data: updateResult.data,
          };
        } else {
          // If update fails, return the existing ID anyway
          Logger.warn("Update failed but returning existing client ID");
          return {
            success: true,
            bmbyId: existingClientId,
            isExisting: true,
            error: updateResult.error,
          };
        }
      }

      // User doesn't exist, create new
      Logger.info("No existing user found, creating new BMBY user:", {
        email: userData.email,
        phone: userData.phoneNumber,
      });

      return await this.createUser(userData, userCredentials);
    } catch (error: any) {
      Logger.error("Error in createOrUpdateUser:", error);
      return {
        success: false,
        error: `Failed to create/update user in BMBY: ${error.message}`,
      };
    }
  }

  /**
   * Update existing user in BMBY
   */
  private async updateUser(
    userData: BmbyUser,
    clientId: string,
    userCredentials: { projectId: string; userId: string }
  ): Promise<BmbyResponse> {
    try {
      const credentials: BmbyCredentials = {
        username: this.defaultCredentials.username,
        password: this.defaultCredentials.password,
        projectId: userCredentials.projectId,
        userId: userCredentials.userId,
      };

      Logger.info("Updating BMBY user:", { email: userData.email, clientId });

      const nameParts = userData.fullName?.trim().split(" ") || [];
      const fname = nameParts[0] || "";
      const lname = nameParts.slice(1).join(" ") || "";

      let buyPlanFieldId: string | null = null;
      const rawBuyPlanTime =
        userData.purchase_readiness ||
        userData.additionalInformation?.purchase_readiness ||
        "";

      if (rawBuyPlanTime) {
        buyPlanFieldId = purchaseReadinessMapper.getId(rawBuyPlanTime);
      }

      const formattedData = this.formatClientDataForBMBY(
        {
          fname,
          lname,
          email: userData.email,
          phone_mobile: userData.phoneNumber,
          region: userData.region,
          gender: userData.gender || "",
          country: userData.region || "",
          purchase_readiness: buyPlanFieldId,
          client_id: parseInt(clientId), // Must be integer for update
        },
        credentials
      );

      const soapEnvelope = this.createInsertSoapEnvelope(formattedData, credentials);

      const response = await fetch(this.soapUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://www.bmby.com/WebServices/srv/v3/Insert",
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.text();
      Logger.info("BMBY Update Response:", result);

      return {
        success: true,
        bmbyId: clientId,
        data: { fname, lname },
        isExisting: true
      };
    } catch (error: any) {
      Logger.error("Error updating BMBY user:", error);
      return {
        success: false,
        error: `Failed to update user in BMBY: ${error.message}`,
      };
    }
  }

  /**
   * Create a new client in BMBY (internal method)
   */
  private async createUser(
    userData: BmbyUser,
    userCredentials: { projectId: string; userId: string }
  ): Promise<BmbyResponse> {
    try {
      const credentials: BmbyCredentials = {
        username: this.defaultCredentials.username,
        password: this.defaultCredentials.password,
        projectId: userCredentials.projectId,
        userId: userCredentials.userId,
      };

      Logger.info("Creating BMBY user:", {
        email: userData.email,
        phone: userData.phoneNumber,
        projectId: credentials.projectId,
        userId: credentials.userId,
      });

      const nameParts = userData.fullName?.trim().split(" ") || [];
      const fname = nameParts[0] || "";
      const lname = nameParts.slice(1).join(" ") || "";

      let buyPlanFieldId: string | null = null;
      const rawBuyPlanTime =
        userData.purchase_readiness ||
        userData.additionalInformation?.purchase_readiness ||
        "";

      if (rawBuyPlanTime) {
        buyPlanFieldId = purchaseReadinessMapper.getId(rawBuyPlanTime);
        Logger.info("Mapped purchase_readiness:", {
          input: rawBuyPlanTime,
          bmbyFieldId: buyPlanFieldId,
        });
      }

      const formattedData = this.formatClientDataForBMBY(
        {
          fname,
          lname,
          email: userData.email,
          phone_mobile: userData.phoneNumber,
          region: userData.region,
          gender: userData.gender || "",
          country: userData.region || "",
          purchase_readiness: buyPlanFieldId,
        },
        credentials
      );

      const soapEnvelope = this.createInsertSoapEnvelope(formattedData, credentials);

      const response = await fetch(this.soapUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://www.bmby.com/WebServices/srv/v3/Insert",
        },
        body: soapEnvelope,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.text();
      Logger.info("BMBY SOAP Response:", result);

      const bmbyId = this.parseInsertResponse(result);

      if (!bmbyId) {
        return {
          success: false,
          error: "BMBY API did not return a client ID",
        };
      }

      Logger.info("✨ BMBY user created successfully with ID:", bmbyId);
      Logger.info("This ID should match when searching in GetAll");

      return {
        success: true,
        bmbyId,
        data: { fname, lname },
        isExisting: false
      };
    } catch (error: any) {
      Logger.error("Error creating BMBY user:", error);
      return {
        success: false,
        error: `Failed to create user in BMBY: ${error.message}`,
      };
    }
  }

  /**
   * Create SOAP envelope for GetAll by email
   */
  private createGetAllByEmailSoapEnvelope(
    email: string,
    credentials: BmbyCredentials
  ): string {
    // Simple filter - just project and email
    const searchFilter = {
      project_id: { value: parseInt(credentials.projectId) },
      email: { value: email.trim().toLowerCase() }
    };

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:v3="http://www.bmby.com/WebServices/srv/v3/">
  <soapenv:Header/>
  <soapenv:Body>
    <v3:GetAll soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <Parameters xsi:type="v3:GetAllInput">
        <Login xsi:type="xsd:string">${credentials.username}</Login>
        <Password xsi:type="xsd:string">${credentials.password}</Password>
        <ProjectID xsi:type="xsd:int">${credentials.projectId}</ProjectID>
        <UniqID xsi:type="xsd:int"></UniqID>
        <TaskID xsi:type="xsd:int"></TaskID>
        <ClientID xsi:type="xsd:int"></ClientID>
        <OwnerID xsi:type="xsd:int"></OwnerID>
        <ContractID xsi:type="xsd:int"></ContractID>
        <Dynamic xsi:type="xsd:int"></Dynamic>
        <Limit xsi:type="xsd:int">10</Limit>
        <Offset xsi:type="xsd:int"></Offset>
        <OrderDesc xsi:type="xsd:int"></OrderDesc>
        <FromDate xsi:type="xsd:string"></FromDate>
        <ToDate xsi:type="xsd:string"></ToDate>
        <Type xsi:type="soapenc:Array" xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"></Type>
        <TypeString xsi:type="xsd:string"></TypeString>
        <SetPrivate xsi:type="xsd:int"></SetPrivate>
      </Parameters>
      <jsonClient xsi:type="xsd:string">${JSON.stringify(searchFilter)}</jsonClient>
    </v3:GetAll>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /**
   * Create SOAP envelope for GetAll by phone
   */
  private createGetAllByPhoneSoapEnvelope(
    phoneNumber: string,
    credentials: BmbyCredentials
  ): string {
    const searchFilter = {
      project_id: { value: parseInt(credentials.projectId) },
      phone_mobile: { value: phoneNumber.trim() }
    };

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:v3="http://www.bmby.com/WebServices/srv/v3/">
  <soapenv:Header/>
  <soapenv:Body>
    <v3:GetAll soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <Parameters xsi:type="v3:GetAllInput">
        <Login xsi:type="xsd:string">${credentials.username}</Login>
        <Password xsi:type="xsd:string">${credentials.password}</Password>
        <ProjectID xsi:type="xsd:int">${credentials.projectId}</ProjectID>
        <UniqID xsi:type="xsd:int"></UniqID>
        <TaskID xsi:type="xsd:int"></TaskID>
        <ClientID xsi:type="xsd:int"></ClientID>
        <OwnerID xsi:type="xsd:int"></OwnerID>
        <ContractID xsi:type="xsd:int"></ContractID>
        <Dynamic xsi:type="xsd:int"></Dynamic>
        <Limit xsi:type="xsd:int">10</Limit>
        <Offset xsi:type="xsd:int"></Offset>
        <OrderDesc xsi:type="xsd:int"></OrderDesc>
        <FromDate xsi:type="xsd:string"></FromDate>
        <ToDate xsi:type="xsd:string"></ToDate>
        <Type xsi:type="soapenc:Array" xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"></Type>
        <TypeString xsi:type="xsd:string"></TypeString>
        <SetPrivate xsi:type="xsd:int"></SetPrivate>
      </Parameters>
      <jsonClient xsi:type="xsd:string">${JSON.stringify(searchFilter)}</jsonClient>
    </v3:GetAll>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private createInsertSoapEnvelope(
    formattedClientData: any,
    credentials: BmbyCredentials
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:v3="http://www.bmby.com/WebServices/srv/v3/">
  <soapenv:Header/>
  <soapenv:Body>
    <v3:Insert soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <Parameters xsi:type="v3:GetAllInput">
        <Login xsi:type="xsd:string">${credentials.username}</Login>
        <Password xsi:type="xsd:string">${credentials.password}</Password>
        <ProjectID xsi:type="xsd:int">${credentials.projectId}</ProjectID>
        <UniqID xsi:type="xsd:int"></UniqID>
        <TaskID xsi:type="xsd:int"></TaskID>
        <ClientID xsi:type="xsd:int"></ClientID>
        <OwnerID xsi:type="xsd:int"></OwnerID>
        <ContractID xsi:type="xsd:int"></ContractID>
        <Dynamic xsi:type="xsd:int"></Dynamic>
        <Limit xsi:type="xsd:int"></Limit>
        <Offset xsi:type="xsd:int"></Offset>
        <OrderDesc xsi:type="xsd:int"></OrderDesc>
        <FromDate xsi:type="xsd:string"></FromDate>
        <ToDate xsi:type="xsd:string"></ToDate>
        <Type xsi:type="soapenc:Array" xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"></Type>
        <TypeString xsi:type="xsd:string"></TypeString>
        <SetPrivate xsi:type="xsd:int"></SetPrivate>
      </Parameters>
      <jsonClient xsi:type="xsd:string">${JSON.stringify(formattedClientData)}</jsonClient>
    </v3:Insert>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private formatClientDataForBMBY(
    clientData: any,
    credentials: BmbyCredentials
  ) {
    const formattedData: any = {
      project_id: { value: parseInt(credentials.projectId) },
      user_id: { value: credentials.userId },
      lead: { value: 1 },
      update: { value: 1 },
    };

    const basicFields = [
      "fname",
      "lname",
      "phone_mobile",
      "email",
      "country",
      "region",
      "gender",
      "purchase_readiness",
      "client_id",
    ];

    basicFields.forEach((field) => {
      const value = clientData[field];
      if (value !== undefined && value !== null && value !== "") {
        formattedData[field] = { value };
      }
    });

    return formattedData;
  }

  /**
 * Parse GetAll response to extract client ID matching the search criteria
 * BMBY returns XML-encoded data inside the SOAP response with multiple <row> elements
 */
  private parseGetAllResponse(
    soapResponse: string,
    searchEmail?: string,
    searchPhone?: string
  ): string | null {
    try {
      // First, check FoundRows to see if any results exist
      const foundRowsMatch = soapResponse.match(/<FoundRows[^>]*>(\d+)<\/FoundRows>/);
      if (foundRowsMatch) {
        const foundRows = parseInt(foundRowsMatch[1]);
        Logger.info("BMBY GetAll found rows:", foundRows);
        if (foundRows === 0) {
          Logger.info("No matching clients found in BMBY");
          return null;
        }
      }

      // Extract the Data field which contains XML-encoded client data
      const dataMatch = soapResponse.match(/<Data[^>]*>(.*?)<\/Data>/s);
      if (!dataMatch) {
        Logger.error("Data field not found in SOAP response");
        return null;
      }

      // Decode HTML entities (&lt; -> <, &gt; -> >)
      let xmlData = dataMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      Logger.info("Decoded XML data (first 800 chars):", xmlData.substring(0, 800));

      // Split into individual <row> elements
      const rowMatches = xmlData.match(/<row>[\s\S]*?<\/row>/g);

      if (!rowMatches || rowMatches.length === 0) {
        Logger.warn("No <row> elements found in XML data");
        return null;
      }

      Logger.info(`Found ${rowMatches.length} row(s) in BMBY response, checking for matches...`);

      // Normalize search criteria for comparison
      const normalizedSearchEmail = searchEmail?.trim().toLowerCase();
      const normalizedSearchPhone = searchPhone?.trim();

      // Iterate through each row to find a match
      for (let i = 0; i < rowMatches.length; i++) {
        const row = rowMatches[i];

        // Extract email and phone from this row
        const emailMatch = row.match(/<email>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/email>/i);
        const phoneMatch = row.match(/<phone_mobile>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/phone_mobile>/i);

        const rowEmail = emailMatch?.[1]?.trim().toLowerCase();
        const rowPhone = phoneMatch?.[1]?.trim();

        Logger.info(`Row ${i + 1}: email="${rowEmail}", phone="${rowPhone}"`);

        // Check if this row matches our search criteria
        let isMatch = false;

        if (normalizedSearchEmail && rowEmail === normalizedSearchEmail) {
          Logger.info(`✓ Email match found in row ${i + 1}`);
          isMatch = true;
        } else if (normalizedSearchPhone && rowPhone === normalizedSearchPhone) {
          Logger.info(`✓ Phone match found in row ${i + 1}`);
          isMatch = true;
        }

        // If we found a match, extract the client_id from this row
        if (isMatch) {
          const idFieldNames = [
            'client_id',
            'ClientID',
            'uniq_id',
            'UniqID',
            'bmby_id',
            'BmbyID'
          ];

          for (const fieldName of idFieldNames) {
            const pattern = new RegExp(`<${fieldName}>(\\d+)<\\/${fieldName}>`, 'i');
            const idMatch = row.match(pattern);

            if (idMatch) {
              const clientId = idMatch[1];
              Logger.info(`✓ Extracted ${fieldName} from matching row: ${clientId}`);
              return clientId;
            }
          }

          Logger.warn("Match found but no client ID field in the row");
        }
      }

      Logger.warn(`No matching row found for email="${normalizedSearchEmail}" or phone="${normalizedSearchPhone}"`);
      return null;

    } catch (error: any) {
      Logger.error("Error parsing GetAll SOAP response:", error.message);
      Logger.error("Response substring:", soapResponse.substring(0, 1000));
      return null;
    }
  }

  private parseInsertResponse(soapResponse: string): string | null {
    try {
      const insertReturnMatch = soapResponse.match(/<InsertReturn[^>]*>(.*?)<\/InsertReturn>/s);

      if (!insertReturnMatch) {
        Logger.error("InsertReturn not found in SOAP response");
        return null;
      }

      const jsonString = insertReturnMatch[1].trim();
      if (!jsonString) return null;

      const jsonData = JSON.parse(jsonString);
      Logger.info("Parsed BMBY Response JSON:", jsonData);

      if (jsonData.Error) {
        Logger.error("BMBY API Error:", jsonData.Error);
        return null;
      }

      const clientId = jsonData.ClientID || jsonData.client_id || jsonData.UniqID;
      return clientId ? clientId.toString() : null;
    } catch (error: any) {
      Logger.error("Error parsing SOAP response:", error.message);
      return null;
    }
  }

  validateCredentials(credentials?: BmbyCredentials): boolean {
    const creds = credentials || this.defaultCredentials;
    const isValid = !!(
      creds.username &&
      creds.password &&
      creds.projectId &&
      creds.userId
    );

    if (!isValid) {
      Logger.error("BMBY credentials are missing or invalid", creds);
    }

    return isValid;
  }
}

export const bmbyService = new BmbyService();