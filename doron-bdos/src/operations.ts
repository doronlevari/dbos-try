import { TransactionContext, Transaction, GetApi, ArgSource, ArgSources } from '@dbos-inc/dbos-sdk'
import { Knex } from 'knex';

import { PostApi } from '@dbos-inc/dbos-sdk' // Add this to your imports.
import { Communicator, CommunicatorContext } from '@dbos-inc/dbos-sdk' // Add these to your imports
import { Workflow, WorkflowContext } from '@dbos-inc/dbos-sdk' // Add these to your imports

// The schema of the database table used in this example.
export interface dbos_hello {
  name: string;
  greet_count: number;
}

export class Hello {

  // @GetApi('/greeting/:user') // Serve this function from HTTP GET requests to the /greeting endpoint with 'user' as a path parameter
  @Transaction()  // Run this function as a database transaction
  static async helloTransaction(ctxt: TransactionContext<Knex>, @ArgSource(ArgSources.URL) user: string) {
    // Retrieve and increment the number of times this user has been greeted.
    const query = "INSERT INTO dbos_hello (name, greet_count) VALUES (?, 1) ON CONFLICT (name) DO UPDATE SET greet_count = dbos_hello.greet_count + 1 RETURNING greet_count;"
    const { rows } = await ctxt.client.raw(query, [user]) as { rows: dbos_hello[] };
    const greet_count = rows[0].greet_count;
    return `Hello, ${user}! You have been greeted ${greet_count} times.\n`;
  }

  @PostApi('/clear/:user') // Serve this function from HTTP POST requests to the /clear endpoint with 'user' as a path parameter
  @Transaction() // Run this function as a database transaction
  static async clearTransaction(ctxt: TransactionContext<Knex>, @ArgSource(ArgSources.URL) user: string) {
    // Delete the database entry for a user.
    await ctxt.client.raw("DELETE FROM dbos_hello WHERE NAME = ?", [user]);
    return `Cleared greet_count for ${user}!\n`;
  }


  @Communicator() // Tell DBOS this function accesses an external service or API.
  static async greetPostman(ctxt: CommunicatorContext, greeting: string) {
    await fetch("https://postman-echo.com/get?greeting=" + encodeURIComponent(greeting));
    ctxt.logger.info(`Greeting sent to postman!`);
  }

  @Transaction()
  static async undoHelloTransaction(ctxt: TransactionContext<Knex>, user: string) {
    // Decrement greet_count.
    await ctxt.client.raw("UPDATE dbos_hello SET greet_count = greet_count - 1 WHERE name = ?", [user]);
  }
  
  @GetApi('/greeting/:user')
  @Workflow()
  static async helloWorkflow(ctxt: WorkflowContext, @ArgSource(ArgSources.URL) user: string) {
    const greeting = await ctxt.invoke(Hello).helloTransaction(user);
    try {
      await ctxt.invoke(Hello).greetPostman(greeting);
      return greeting;
    } catch (e) {
      ctxt.logger.error(e);
      await ctxt.invoke(Hello).undoHelloTransaction(user);
      return `Greeting failed for ${user}\n`;
    }
  }
  
  
    


}
