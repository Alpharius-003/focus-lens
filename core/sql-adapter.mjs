// Match the small synchronous database surface used by the shared review store.
export class SqlAdapter {
  constructor(database){this.database=database;this.open=true;}
  exec(sql){this.database.exec(sql);}
  pragma(){return [];}
  prepare(sql){const database=this.database;return {
    run(...args){database.run(sql,args);},
    all(...args){const statement=database.prepare(sql);try{statement.bind(args);const rows=[];while(statement.step())rows.push(statement.getAsObject());return rows;}finally{statement.free();}},
    get(...args){const statement=database.prepare(sql);try{statement.bind(args);return statement.step()?statement.getAsObject():undefined;}finally{statement.free();}}
  };}
  close(){if(this.open)this.database.close();this.open=false;}
}
