# Node, Mongo, Nginx Stack

## Reference

[How to setup user authentication in MongoDB 3.0](https://medium.com/@matteocontrini/how-to-setup-auth-in-mongodb-3-0-properly-86b60aeef7e8#.vnmysizsb)

[MongoDB Authentication example](https://www.mkyong.com/mongodb/mongodb-authentication-example/)

[Docker now supports adding host mappings](http://jasani.org/2014/11/19/docker-now-supports-adding-host-mappings/)

[Nginx and Node.js with Docker](http://schempy.com/2015/08/25/docker_nginx_nodejs/)

[A sample Docker workflow with Nginx, Node.js and Redis](http://anandmanisankar.com/posts/docker-container-nginx-node-redis-example/)

[Setting up a Replicated MongoDB using Authentication in Docker on DigitalOcean](http://variable.dk/blog/633-a-replicated-mongodb-using-authentication-in-docker-on-digitalocean)

## Mongo
#### Start up mongo initially
``` bash
$ docker run --name mongo -v "$PWD"/mongo/data:/data/db -p 27017:27017 -d mongo
```
#### Add Admin users to this database which will be used used for authenticating users

* First we need to connect to the database from another mongo container
``` bash
$ docker run -it --link mongo:mongo --rm mongo sh -c 'exec mongo "mongo:27017/test"'
```
* Adding users
When you're connected to the MongoDB you're going to want to switch to the Admin database, using,
``` bash
$ use admin
```

Now we can add users. Create a new site admin user called siteUserAdmin,
``` bash
$ db.createUser ({
	user: "siteUserAdmin",
	pwd: "siteUserAdmin",
	roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
});
```
and a Root User called siteRootAdmin,
``` bash
$ db.createUser ({
	user: "siteRootAdmin",
	pwd: "siteRootAdmin",
	roles: [ { role: "root", db: "admin" } ]
});
```
Now exit the mongo-container with the apply named command exit

* Stop the mongo again, and remove it
``` bash
$ docker stop mongo
$ docker rm -f mongo
```

#### Start the database again with authentication
To start database again and enable authentication let add `--auth` flag in command,

``` bash
$ docker run --name mongo -v "$PWD"/mongo/data:/data/db -p 27017:27017 -d mongo --auth
```
#### Create `hitdb` for nodejs testing application
We need connect again to mongo database with command in previous section and connect to `hitdb`,

``` bash
$ use hitdb
```

Let's create user for `hitdb` ,

``` bash
$ db.createUser ({
    user: "hitdbadmin",
    pwd: "hitdbadmin",
    roles: [ { role: "root", db: "admin" } ]
});
```

Now, the `hitdb` is already to using for node.js application.

## Nodejs
We will create an simple application with only one feature which there are request (GET method) from client, application will count up one and save result into `hitdb` (this database is created in previous section).

#### Install nodejs package
Let start by installing Express.js,

```bash
$ npm install express
```

and Mongodb driver,

```bash
$ npm isntall mongodb
```

#### Create nodejs application

Let's create file `src/app.js` and input code such as,

``` javascript
'use strict';
const app = require ('express') ();

module.exports = function createApp (db) {
    app.get ('/hit', (req, res) => {
        let collection = db.collection ('hitcollection');
        collection.findOne ({name:'hit'})
            .then ((doc) => {
               if (doc) {
                   collection.updateOne ({name:'hit'},{$set: {count: doc.count + 1}})
                    .then ((docUpdate) => {
                        res.status (200).send (`Hit ${doc.count+1}`);
                    })
                    .catch ((error) => {
                        res.status (500).send ('Server error');
                    });
               } else {
                   collection.insertOne ({name:'hit', count: 1})
                    .then ((docCreated) => {
                        res.status (201).send ('Hit 1');
                    })
                    .catch ((error) => {
                        res.status (500).send ('Server error');
                    });
               }
            })
            .catch ((error) => {
                res.status (500).send ('Server error');
            });
    });
    return app;
}
```

This code is simple creating an Express.js app with parameter is mongodb (`db`). You can understand code will do,

* Try to finding in database document with name `hit` in collection with name `hitcollection`
* If `hit` document is exist, let update count up to one and save again to database.
* If `hit` document is not exist, let create new one and save to database with count is `1`.

Next, we create `src/index.js` to connecting to `hitdb` database and start express application, let's input code such as,

``` javascript
'use strict';
const app = require ('./app');
const mongodb = require ('mongodb');
let MongoClient = mongodb.MongoClient;

const mongoUrl = 'mongodb://hitdbadmin:hitdbadmin@mongo:27017/hitdb';
const port = process.env.PORT | 3000;

MongoClient.connect (mongoUrl, (error, db) => {
    if (error) return console.error ('Cannot connect to MongoDB. Error', error);
    console.log ('Connect to MongoDB successful!');
    app(db).listen (port, () => console.log ('Application listen at ' + port));
});
```

This code start connection to mongodb with Mongodb driver and Url `mongodb://hitdbadmin:hitdbadmin@mongo:27017/hitdb` with,
* `hitdbadmin:hitdbadmin` is user and password of `hitdb`
* `mongo:27017` is address of mongo in docker

> **Note**: If mongo is installed same machine or test with current mongo in docker, you can use `localhost:27017` or `127.0.0.1:27017`

Now, start the nodejs application you will see,

``` bash
$ node src/index.js
Connect to MongoDB successful!
Application listen at 3000
```

Let's count up hit with `curl` in terminal
``` bash
$ curl localhost:3000/hit
Hit 1%                                                                                                                                                                                                      $ curl localhost:3000/hit
Hit 2%                                                                                                                                                                                                      
```

Yeah, nodejs application is done. Let's dockerize application with **Dockerfile** such as,

```dockerfile
# Start with base image from official
FROM node:6.9.2-alpine
MAINTAINER duytran
# Change workdir
WORKDIR /app
# Add current src and install file
ADD src src
ADD package.json package.json
# Run update and install package for application
RUN npm update
# Start application
CMD node src/index.js
```

And build it with command,

```bash
$ docker build -t node-hit .
```

Start nodejs application docker,

``` bash
$ docker run -d --name node-app --link mongo:mongo -p 3000:3000 node-hit
```

To make sure, node application start successful, type command,

``` bash
$ docker logs node-app
Connect to MongoDB successful!
Application listen at 3000
```

Ok,  Everything done. Let's move to next secion.

## Nginx

We need pull Nginx image from DockerHub. Execute the following bash command to do just that:

```bash
$ docker pull nginx:latest
```

We'll be using a custom `nginx/nginx.conf` file that will be mapped to the containers `/etc/nginx` directory. Here is the server portion whichs defines the proxy to the node.js server

```conf
    ...
    server {
            listen 80;
            index index.html;
            server_name localhost;
            error_log  /var/log/nginx/error.log;
            access_log /var/log/nginx/access.log;
            root /var/www/public;

            location ~* /hit {
                proxy_pass http://node-app:3000;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
            }
        }
```

The configuration will proxy requests to the url `/hit` to the Node.js Docker container! Note the proxy_pass entry, uses the name of the Node.js Docker container, `node-app`, that was created.


To create the Nginx container execute the following bash command from the project root directory:

```bash
$ docker run -d --name web -p 8080:80 -v $(pwd)/web/src:/var/www -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf --link node-app:node-app nginx
```

Confirm the Nginx Docker container is running by executing the following bash command:

```bash
$ docker ps
```

You should see a running container with the name web.

Point your browser to `http://localhost:8080`. CLick on the link labled HIT and that will take you to the nodejs server! Notice the link does not contain the port 3000. This is because Nginx is configured to use the /hit url as a proxy to the nodejs server.

Full source code for this example [docker-node-mongo-nginx](https://github.com/duytran/docker-node-mongo-nginx)
