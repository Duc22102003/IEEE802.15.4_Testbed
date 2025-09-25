/***************************************************************************//**
 * @file
 * @brief
 *******************************************************************************
 * # License
 * <b>Copyright 2020 Silicon Laboratories Inc. www.silabs.com</b>
 *******************************************************************************
 *
 * SPDX-License-Identifier: Zlib
 *
 * The licensor of this software is Silicon Laboratories Inc.
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 *
 ******************************************************************************/

#include "rail.h"
#include "rail_ieee802154.h"
#include "sl_status.h"
#include "sl_rail_util_ieee802154_stack_event.h"
#include "sl_assert.h"
#include "sl_rail_util_ieee802154_phy_select.h"
#include "sl_iostream.h"
#include "lower-mac.h"
#include "upper-mac.h"
#include "em_system.h"
extern RAIL_Handle_t emPhyRailHandle;
extern uint8_t *sli_mac_upper_mac_outgoing_flat_packet_ptr;
void PrintEUID64()
{
  uint64_t uniqueId = SYSTEM_GetUnique();
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "{ID64: %016llX}", uniqueId);
}
void PrintDataRX()
{
  uint8_t peekBuffer[128];
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Data:{");
  uint16_t bytesPeeked = RAIL_PeekRxPacket(emPhyRailHandle,
                                           RAIL_RX_PACKET_HANDLE_NEWEST,
                                           peekBuffer,
                                           sizeof(peekBuffer),
                                           0);
  for (uint16_t i = 0; i < bytesPeeked; i++) {
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "%02X ", peekBuffer[i]);
  }
  RAIL_RxPacketInfo_t PackInfo;
  RAIL_RxPacketDetails_t PackDetail;
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "}");
  RAIL_RxPacketHandle_t PackHandle = RAIL_GetRxPacketInfo(emPhyRailHandle, RAIL_RX_PACKET_HANDLE_NEWEST, &PackInfo);
  RAIL_GetRxPacketDetails(emPhyRailHandle, PackHandle, &PackDetail);
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Channel: %d}{RSSI: %d}{LQI: %d}{IsACK: %d}{SyncWord: %d}{Time: %ld}{CRCPass: %d}{SubPhyID: %d}{AntenaID: %d}", PackDetail.channel,PackDetail.rssi,PackDetail.lqi,PackDetail.isAck, PackDetail.syncWordId,PackDetail.timeReceived.packetTime,PackDetail.crcPassed,PackDetail.subPhyId, PackDetail.antennaId);
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "}\r\n");
}
void PrintTX()
{
//  sl_mac_upper_mac_state_t *state = &sli_mac_upper_mac_state[0];
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Data:{");
  for(int i = 0; i < sli_mac_upper_mac_outgoing_flat_packet_ptr[0] - 1; i++)
    {
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "%02X ", sli_mac_upper_mac_outgoing_flat_packet_ptr[i]);
    }
//  for(int i = 126; i >= 0; i--)
//    {
//      if(state->outgoing_flat_packet[i] != 0)
//        {
//          for(int j = 0; j <= i; j++)
//            {
//              sl_iostream_printf(SL_IOSTREAM_STDOUT, "%02X ", state->outgoing_flat_packet[j]);
//            }
//          break;
//        }
//    }
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "}{Time: %ld}}\r\n", RAIL_GetTime());
}
sl_rail_util_ieee802154_stack_status_t sl_rail_util_ieee802154_on_event(
  sl_rail_util_ieee802154_stack_event_t stack_event,
  uint32_t supplement)
{
  if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_STARTED) {
      PrintEUID64();
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_STARTED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_FILTERED) {
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_FILTERED}");
    PrintEUID64();
    PrintDataRX();
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACCEPTED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_ACCEPTED}");
    PrintDataRX();
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_CORRUPTED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_CORRUPTED}");
    PrintDataRX();
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACKING) {
      PrintEUID64();
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_ACKING}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACK_BLOCKED) {
      PrintEUID64();
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_ACK_BLOCKED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACK_ABORTED) {
      PrintEUID64();
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_ACK_ABORTED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACK_SENT) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_ACK_SENT}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ENDED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_ENDED}");
    PrintDataRX();
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_IDLED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_IDLED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_LISTEN) {
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: RX_LISTEN}{Time: %ld}\r\n", RAIL_GetTime());
    PrintEUID64();
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_PENDED_MAC) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_PENDED_MAC}");
    PrintTX();
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_PENDED_PHY) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_PENDED_PHY}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_CCA_SOON) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_CCA_SOON}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_CCA_BUSY) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_CCA_BUSY}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_STARTED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_STARTED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_BLOCKED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_BLOCKED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ABORTED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_ABORTED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ACK_WAITING) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_ACK_WAITING}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ACK_RECEIVED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_ACK_RECEIVED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ACK_TIMEDOUT) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_ACK_TIMEDOUT}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ENDED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_ENDED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_IDLED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: TX_IDLED}{Time: %ld}\r\n", RAIL_GetTime());
  } else if (stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_SIGNAL_DETECTED) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Event: SIGNAL_DETECTED}{Time: %ld}\r\n", RAIL_GetTime());
  }
  if(stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACKING || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ENDED || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_ACK_SENT || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_RX_IDLED)
    {
      sl_rail_util_ieee802154_phy_select_on_event(stack_event, supplement);
    }
  else if(stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_PENDED_MAC || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_PENDED_PHY || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ACK_WAITING || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ACK_RECEIVED || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ENDED || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_IDLED || stack_event == SL_RAIL_UTIL_IEEE802154_STACK_EVENT_TX_ACK_TIMEDOUT)
    {
      sl_rail_util_ieee802154_phy_select_on_event(stack_event, supplement);
    }
  return SL_RAIL_UTIL_IEEE802154_STACK_STATUS_SUCCESS;
}
