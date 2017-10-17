pragma solidity ^0.4.11;

contract EventEmitter {
  event Emitted(uint value);

  function emit (uint value) public {
    Emitted(value);
  }
}
