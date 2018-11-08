import parentLogger from "./logger";
import { API, SaveTransaction } from "ynab";
import { ITransaction, parse } from "ofx-js";
import { stringify } from "querystring";
import moment = require("moment");

const logger = parentLogger.child({ module: "ynab" });

export class YnabWrapperClient {
  public static async ofxToTransactions(accountID: string, input: string) {
    const res = await parse(input);
    const counters: { [index: string]: number } = {};

    function getImportID(trans: ITransaction, date: string, amount: number) {
      const prefix = `YNAB:${amount}:${date}`;

      if (!counters[prefix]) {
        counters[prefix] = 1;
      } else {
        counters[prefix]++;
      }

      return `${prefix}:${counters[prefix]}`;
    }

    return res.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN.map(
      (trans): SaveTransaction => {
        const amount = +(trans.TRNAMT.replace(".", "") + "0");
        const date = moment(trans.DTPOSTED, "YYYYMMDD").format("YYYY-MM-DD");

        return {
          account_id: accountID,
          amount,
          date,
          import_id: getImportID(trans, date, amount),
          memo: trans.MEMO,
          payee_name: trans.NAME
        };
      }
    );
  }

  public client: API;
  public budgetID: string;

  constructor(accessToken: string, budgetID: string) {
    this.budgetID = budgetID;
    this.client = new API(accessToken);
  }

  public async importOFX(accountID: string, input: string) {
    const transactions = await YnabWrapperClient.ofxToTransactions(
      accountID,
      input
    );

    logger.debug(`Importing ${transactions.length} transactions`);

    const res = await this.client.transactions.createTransactions(
      this.budgetID,
      {
        transactions
      }
    );

    return res;
  }
}
