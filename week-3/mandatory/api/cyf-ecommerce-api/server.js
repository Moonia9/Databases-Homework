const express = require("express");
const { Pool } = require("pg");
const app = express();
const secret = require("./secret.json");
const pool = new Pool(secret);

app.get("/customers", function (req, res) {
  pool.query("SELECT * FROM customers", (error, result) => {
    res.json(result.rows);
  });
});

app.get("/suppliers", function (req, res) {
  pool.query("SELECT * FROM suppliers", (error, result) => {
    res.json(result.rows);
  });
});

//1. Add a new GET endpoint `/products` to load all the product names along with their supplier names
app.get("/products", (req, res) => {
  //2. Update the previous GET endpoint `/products` to filter the list of products by name using a query parameter, for example `/products?name=Cup`. This endpoint should still work even if you don't use the `name` query parameter
  const productNameQuery = req.query.name;
  let query = `SELECT p.product_name, s.supplier_name
  FROM products p 
  INNER JOIN suppliers s ON s.id = p.supplier_id`;

  if (productNameQuery) {
    query = `SELECT p.product_name, s.supplier_name
    FROM products p 
    INNER JOIN suppliers s ON  p.supplier_id = s.id 
    WHERE p.product_name LIKE '%${productNameQuery}%'`;
  }
  pool.query(query, (error, result) => {
    res.json(result.rows);
  });
});

//3. Add a new GET endpoint `/customers/:customerId` to load a single customer by ID
app.get("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;
  pool
    .query("SELECT * FROM customers WHERE id=$1", [customerId])
    .then((result) => res.json(result.rows))
    .catch((error) => {
      console.log(error);
      res.status(500).send("Internal Error");
    });
});

//4. Add a new POST endpoint `/customers` to create a new customer
app.post("/customers", function (req, res) {
  const newName = req.body.name;
  const newAddress = req.body.address;
  const newCity = req.body.city;
  const newCountry = req.body.country;

  //Adding a validation
  if (
    newName === "" ||
    newAddress === "" ||
    newCity === "" ||
    newCountry === ""
  ) {
    res
      .send(400)
      .status(
        "Please provide the following information : name, address, city and country"
      );
  }

  pool
    .query(
      `
  INSERT INTO customers (name, address, city, country)
  VALUES ($1, $2, $3, $4);
  `,
      [newName, newAddress, newCity, newCountry]
    )
    .then(() => res.send("Added new customer"))
    .catch((e) => console.error(e));
  res.status(500).send("Internal Error");
});

//5. Add a new POST endpoint `/products` to create a new product (with a product name, a price and a supplier id).
//Check that the price is a positive integer and that the supplier ID exists in the database, otherwise return an error
app.post("/products", function (req, res) {
  const productName = req.body.name;
  const price = req.body.price;
  const supplierId = req.body.supplierId;

  if (price <= 0) {
    return res.status(400).send("Price needs to be a positive number");
  }

  pool.query(
    "SELECT * FROM suppliers WHERE id=$1",
    [supplierId].then((result) => {
      if (result.rows.length === 0) {
        return res.status(400).send("Supplier does not exist");
      }

      pool.query(
        "INSERT INTO products (product_name, price, supplier_id) VALUES ($1, $2, $3)",
        [productName, price, supplierId]
          .then(() => res.send("Product has been created"))
          .catch((e) => {
            console.error(e);
            res.status(500).send("Internal Server Error");
          })
      );
    })
  );
});

//6. Add a new POST endpoint `/customers/:customerId/orders` to create a new order (including an order date, and an order reference) for a customer
//Check that the customerId corresponds to an existing customer or return an error
app.post("/customers/:customerId/orders", function (req, res) {
  const customerId = req.params.customerId;
  const date = req.body.date;
  const reference = req.body.reference;

  pool
    .query("SELECT * FROM customers WHERE id=$1", [customerId])
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(400).send("Customer does not exist");
      }
      pool
        .query(
          "INSERT INTO orders (order_date, order_reference, customer_id) VALUES ($1, $2, $3)",
          [date, reference, customerId]
        )
        .then(() => res.send("The order has been created"))
        .catch((e) => {
          console.error(e);
          res.status(500).send("Internal error");
        });
    });
});

//7. Add a new PUT endpoint `/customers/:customerId` to update an existing customer (name, address, city and country)
app.put("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;
  const name = req.body.name;
  const address = req.body.address;
  const city = req.body.city;
  const country = req.body.country;
  //Adding a validation
  if (name === "" || address === "" || city === "" || country === "") {
    res
      .send(400)
      .status(
        "Please provide the following information : name, address, city and country"
      );
  }
  pool
    .query(
      "UPDATE customers SET name=$1, address=$2, city=$3, country=$4 WHERE id=$5",
      [name, address, city, country, customerId]
    )
    .then(() => res.send("Customer has been updated"))
    .catch((e) => {
      console.error(e);
      res.status(500).send("Internal error");
    });
});

//8. Add a new DELETE endpoint `/orders/:orderId` to delete an existing order along all the associated order items
app.delete("/orders/:orderId", function (req, res) {
    const orderId = req.params.orderId;
    pool
        .query("DELETE FROM order_items WHERE order_id=$1", [orderId])
        .then(() =>
            pool
                .query("DELETE FROM orders WHERE id=$1", [orderId])
                .then(() => res.send(`Order ${orderId} deleted with its order items!`))
                .catch((e) => console.error(e)));
});

//9. Add a new DELETE endpoint `/customers/:customerId` to delete an existing customer only if this customer doesn't have orders.
app.delete("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;

  pool
    .query("SELECT * FROM orders WHERE customer_id=$1", [customerId])
    .then((result) => {
      if (result.rows.length > 0) {
        return res.status(400).send("This customer has still available orders");
      }
      pool
        .query("DELETE FROM customers WHERE id=$1", [customerId])
        .then(() => res.send("Customer has been deleted"))
        .catch((e) => {
          console.error(e);
          res.status(500).send("Internal error");
        });
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send("Internal error");
    });
});

//10. Add a new GET endpoint `/customers/:customerId/orders` to load all the orders along the items in the orders of a specific customer. Especially, the following information should be returned: order references, order dates, product names, unit prices, suppliers and quantities
app.get("/customers/:customerId/orders", function(req, res){
  const customerId = req.params.customerId;

  pool
  .query(`SELECT o.order_reference, o.order_date, p.product_name, p.unit_price, s.supplier_name, oi.quantity 
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  WHERE customer_id=$1`,[customerId])
  .then(result => res.json(result.rows))
  .catch((e) => {
      console.error(e);
      res.status(500).send("Internal error");
    });
})

app.listen(3000, function () {
  console.log("Server is listening on port 3000");
});
