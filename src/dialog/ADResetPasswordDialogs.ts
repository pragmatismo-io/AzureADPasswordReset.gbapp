/*****************************************************************************\
|                                               ( )_  _                       |
|    _ _    _ __   _ _    __    ___ ___     _ _ | ,_)(_)  ___   ___     _     |
|   ( '_`\ ( '__)/'_` ) /'_ `\/' _ ` _ `\ /'_` )| |  | |/',__)/' _ `\ /'_`\   |
|   | (_) )| |  ( (_| |( (_) || ( ) ( ) |( (_| || |_ | |\__, \| ( ) |( (_) )  |
|   | ,__/'(_)  `\__,_)`\__  |(_) (_) (_)`\__,_)`\__)(_)(____/(_) (_)`\___/'  |
|   | |                ( )_) |                                                |
|   (_)                 \___/'                                                |
|                                                                             |
|    Copyright 2018 (c) pragmatismo.io. Todos os direitos reservados.         |
\*****************************************************************************/

"use strict";

import { IGBDialog, GBMinInstance } from "botlib";
import { BotAdapter } from "botbuilder";
import { Messages } from "../strings";

const PasswordGenerator = require("strict-password-generator").default;
const MicrosoftGraph = require("@microsoft/microsoft-graph-client");

export class ADResetPasswordDialogs extends IGBDialog {

  token: string;

  /**
   * Setup dialogs flows and define services call.
   *
   * @param bot The bot adapter.
   * @param min The minimal bot instance data.
   */
  static setup(bot: BotAdapter, min: GBMinInstance) {

    min.dialogs.add("/Security_ResetPassword", [
      async dc => {

        // Manages state.

        dc.activeDialog.state.resetInfo = {};
        const locale = dc.context.activity.locale;

        // Prompts for the guest's name.

        await dc.context.sendActivity(Messages[locale].ok_get_information);
        await dc.prompt("textPrompt", Messages[locale].whats_email);
      },
      async (dc, email) => {
        // Manages state.

        const locale = dc.context.activity.locale;
        dc.activeDialog.state.resetInfo.email = email;

        // Prompts for the guest's mobile number.

        await dc.prompt("textPrompt", Messages[locale].whats_mobile);
      },
      async (dc, mobile) => {
        // Manages state.

        const locale = dc.context.activity.locale;
        dc.activeDialog.state.resetInfo.mobile = mobile;

        dc.activeDialog.state.resetInfo.adminToken = await min.core.adminService.getValue("authenticatorToken")

        let savedMobile = await ADResetPasswordDialogs.getUserMobile(dc.activeDialog.state.resetInfo.adminToken,
          dc.activeDialog.state.resetInfo.email
        );

        if (savedMobile != mobile) {
          dc.endAll();
          throw new Error('invalid number')
        }

        // Generates a new mobile code.

        let code = ADResetPasswordDialogs.getNewMobileCode();
        dc.activeDialog.state.resetInfo.sentCode = code;

        // Sends a confirmation SMS.

        await min.conversationService.sendSms(
          mobile,
          Messages[locale].please_use_code(code)
        );
        await dc.context.sendActivity(Messages[locale].confirm_mobile);
      },
      async (dc, typedCode) => {
        // Manages state.

        const locale = dc.context.activity.locale;


        // Checks if the typed code is equal to the one
        // sent to the registered mobile.

//        if (typedCode == dc.activeDialog.state.resetInfo.sentCode) {
          let password = ADResetPasswordDialogs.getRndPassProfile();
          
          await ADResetPasswordDialogs.resetADPassProfile(dc.activeDialog.state.resetInfo.adminToken,
            dc.activeDialog.state.resetInfo.email,
            password
          );
          
          await dc.context.sendActivity(
            Messages[locale].new_password(password)
          );
        }
  //    }
    ]);
  }

  private static async getUserMobile(token: string, email: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let client = MicrosoftGraph.Client.init({
        authProvider: done => {
          done(null, token);
        }
      });
      client.api(`/users/${email}`).get((err, res) => {
        if (err) { reject(err) }
        else { resolve(res.value); }
      });

    });
  }

  private static async resetADPassProfile(token: string, email: string, passProfile: string) {
    return new Promise<string>((resolve, reject) => {
      let client = MicrosoftGraph.Client.init({
        authProvider: done => {
          done(null, token);
        }
      });
      const account = {
        accountEnabled: true,
        passwordProfile: {
          password: passProfile,
          forceChangePasswordNextSignIn: "true"
        }
      };

      client.api(`/users/${email}`).patch(account, (err, res) => {
        if (err) {
          reject(err)
        }
        else {
          resolve(res);
        }
      });
    });
  }

  private static getRndPassProfile() {
    const passwordGenerator = new PasswordGenerator();
    const options = {
      upperCaseAlpha: false,
      lowerCaseAlpha: true,
      number: true,
      specialCharacter: false,
      minimumLength: 10,
      maximumLength: 12
    };
    let password = passwordGenerator.generatePassword(options);
    return password;
  }

  private static getNewMobileCode() {
    const passwordGenerator = new PasswordGenerator();
    const options = {
      upperCaseAlpha: false,
      lowerCaseAlpha: false,
      number: true,
      specialCharacter: false,
      minimumLength: 4,
      maximumLength: 4
    };
    let code = passwordGenerator.generatePassword(options);
    return code;
  }
}
