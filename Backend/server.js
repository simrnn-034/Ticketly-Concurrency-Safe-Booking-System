const express=require("express");
const app=express();

app.get('/',(req,res)=>{
        console.log("This is the home page");
        res.end("Welcome to home page!");
});

app.listen(8000,()=>{
    console.log("The server has started");
});