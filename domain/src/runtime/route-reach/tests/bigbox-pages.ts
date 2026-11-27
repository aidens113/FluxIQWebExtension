// Two pages of bigbox `run-mwz29d50-c3a32a9c`, cut down to the controls these tests
// read, as the client captured them (the Lab's own bigbox-retail fixture site):
//
//   - the product page attempt 2 stood on when the drawer's "View cart" was not found
//     (the snapshot inside the client's answer to that failed press, trace 14:15:01.883);
//   - the cart page attempt 1 reached through that drawer (capture at 14:14:04.692).
//
// Each element keeps the capture's own fields that the packet reads for a link: tag,
// selector, address, name, role, landmark, whether it is on screen. Nothing else of
// the pages is kept.

/** The product page, with the header's cart link and no drawer: the Add was not made again. */
export const BIGBOX_PRODUCT_PAGE = {
  "url": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166",
  "title": "ValueRidge Essentials Paper Towels, 1 Roll - ValueRidge",
  "interactiveElements": [
    {
      "tagName": "a",
      "selector": "body > div > header > div > a",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/",
      "accessibleName": "ValueRidge",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "banner"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > div > nav > a:nth-of-type(1)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166#",
      "accessibleName": "ReorderMy Items",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation"
      },
      "attributes": {
        "href": "#"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > div > nav > a:nth-of-type(2)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166#",
      "accessibleName": "Sign InAccount",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation"
      },
      "attributes": {
        "href": "#"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > div > nav > a:nth-of-type(3)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/cart",
      "accessibleName": "🛒2$5.25",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/cart"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > nav > a:nth-of-type(1)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166#",
      "accessibleName": "Departments",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation",
        "landmarkName": "Departments"
      },
      "attributes": {
        "href": "#"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > nav > a:nth-of-type(4)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/search?q=paper+towels&facet=special_offers%3ARollback",
      "accessibleName": "Rollbacks & More",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation",
        "landmarkName": "Departments"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/search?q=paper+towels&facet=special_offers%3ARollback"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > nav > a:nth-of-type(10)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/weekly-ad",
      "accessibleName": "Weekly Ad",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation",
        "landmarkName": "Departments"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/weekly-ad"
      }
    },
    {
      "tagName": "a",
      "selector": "main > div:nth-of-type(1) > div:nth-of-type(2) > p > a",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/seller/valueridge",
      "accessibleName": "ValueRidge",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "cursor": "pointer",
      "context": {
        "landmark": "main",
        "heading": "ValueRidge Essentials Paper Towels, 1 Roll"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/seller/valueridge"
      }
    },
    {
      "tagName": "a",
      "selector": "main > section:nth-of-type(3) > ul > li:nth-of-type(1) > a:nth-of-type(1)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-select-a-size-paper-towels/418830127",
      "accessibleName": "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls",
      "implicitRole": "link",
      "isVisibleOnViewport": false,
      "cursor": "pointer",
      "context": {
        "landmark": "main",
        "heading": "Similar items you might like"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/ip/valueridge-essentials-select-a-size-paper-towels/418830127"
      }
    },
    {
      "tagName": "a",
      "selector": "main > section:nth-of-type(3) > ul > li:nth-of-type(2) > a",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/loftwell-ultra-strong-paper-towels-6-double-rolls/402917554",
      "accessibleName": "Loftwell Ultra Strong Paper Towels, 6 Double Rolls",
      "implicitRole": "link",
      "isVisibleOnViewport": false,
      "cursor": "pointer",
      "context": {
        "landmark": "main",
        "heading": "Similar items you might like"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/ip/loftwell-ultra-strong-paper-towels-6-double-rolls/402917554"
      }
    },
    {
      "tagName": "button",
      "selector": "[data-testid=\"atc\"]",
      "accessibleName": "Add to cart",
      "implicitRole": "button",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "main",
        "heading": "Similar items you might like"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > footer > div > a:nth-of-type(1)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166#",
      "accessibleName": "All Departments",
      "implicitRole": "link",
      "isVisibleOnViewport": false,
      "cursor": "pointer",
      "context": {
        "landmark": "contentinfo",
        "heading": "Similar items you might like"
      },
      "attributes": {
        "href": "#"
      }
    }
  ]
} as const;

/** The cart page. */
export const BIGBOX_CART_PAGE = {
  "url": "http://127.0.0.1:52163/scenarios/bigbox-retail/cart",
  "title": "Cart - ValueRidge",
  "interactiveElements": [
    {
      "tagName": "a",
      "selector": "body > div > header > div > a",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/",
      "accessibleName": "ValueRidge",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "banner"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > header > div > nav > a:nth-of-type(3)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/cart",
      "accessibleName": "🛒2$5.25",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "frontLayer": true,
      "cursor": "pointer",
      "context": {
        "landmark": "navigation"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/cart"
      }
    },
    {
      "tagName": "a",
      "selector": "main > div:nth-of-type(1) > div > section > div:nth-of-type(2) > div > a",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-ultra-dish-soap-lemon-scent-24-fl-oz/418832007?variant=5530601",
      "accessibleName": "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "cursor": "pointer",
      "context": {
        "landmark": "main",
        "heading": "Cart (2 items)"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/ip/valueridge-ultra-dish-soap-lemon-scent-24-fl-oz/418832007?variant=5530601"
      }
    },
    {
      "tagName": "a",
      "selector": "main > div:nth-of-type(1) > div > section > div:nth-of-type(3) > div > a",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166?variant=5510204",
      "accessibleName": "ValueRidge Essentials Paper Towels, 1 Roll",
      "implicitRole": "link",
      "isVisibleOnViewport": true,
      "cursor": "pointer",
      "context": {
        "landmark": "main",
        "heading": "Cart (2 items)"
      },
      "attributes": {
        "href": "/scenarios/bigbox-retail/ip/valueridge-essentials-paper-towels-1-roll/418830166?variant=5510204"
      }
    },
    {
      "tagName": "a",
      "selector": "body > div > footer > div > a:nth-of-type(1)",
      "href": "http://127.0.0.1:52163/scenarios/bigbox-retail/cart#",
      "accessibleName": "All Departments",
      "implicitRole": "link",
      "isVisibleOnViewport": false,
      "cursor": "pointer",
      "context": {
        "landmark": "contentinfo",
        "heading": "Frequently bought together"
      },
      "attributes": {
        "href": "#"
      }
    }
  ]
} as const;
