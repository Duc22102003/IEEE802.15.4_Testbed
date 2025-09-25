/***************************************************************************//**
 * @file main.c
 * @brief main() function.
 *******************************************************************************
 * # License
 * <b>Copyright 2025 Silicon Laboratories Inc. www.silabs.com</b>
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
#include "sl_component_catalog.h"
#include "sl_main_init.h"
#if defined(SL_CATALOG_POWER_MANAGER_PRESENT)
#include "sl_power_manager.h"
#endif
#if defined(SL_CATALOG_KERNEL_PRESENT)
#include "sl_main_kernel.h"
#else // SL_CATALOG_KERNEL_PRESENT
#include "sl_main_process_action.h"
#endif // SL_CATALOG_KERNEL_PRESENT
#include "sl_cli.h"
#include "sl_cli_handles.h"
#include "sl_zigbee_debug_print.h"
#include "rail_types.h"
#include "rail.h"
#include "sl_cli_config.h"
#include "sl_zigbee_multi_network.h"
#include "sl_zigbee.h"
#include "sl_zigbee_types.h"
#include "em_cmu.h"
#include "Add.h"
extern RAIL_Handle_t emPhyRailHandle;

#ifdef SL_ZIGBEE_TEST
int nodeMain(void)
#else
#if defined(__ICCARM__)
#pragma diag_suppress=Pe111
#endif // defined(__ICCARM__)
int main(void)
#endif
{
  // Initialize Silicon Labs device, system, service(s) and protocol stack(s).
  // Note that if the kernel is present, the start task will be started and software component
  // configuration will take place there.
  sl_main_init();

#if defined(SL_CATALOG_KERNEL_PRESENT)
  // Start the kernel. The start task will be executed (Highest priority) to complete
  // the Simplicity SDK components initialization and the user app_init() hook function will be called.
  sl_main_kernel_start();
#else // SL_CATALOG_KERNEL_PRESENT

  // User provided code.
  app_init();
  init_custom_cli_commands();
  RAIL_ConfigEvents(emPhyRailHandle, RAIL_EVENT_TX_CCA_RETRY|
                    RAIL_EVENT_TX_ABORTED|
                    RAIL_EVENT_TX_BLOCKED|
                    RAIL_EVENT_TX_BLOCKED_TOO_HOT|
                    RAIL_EVENT_TX_SCHEDULED_TX_MISSED|
                    RAIL_EVENT_TX_UNDERFLOW|
                    RAIL_EVENT_TX_CHANNEL_BUSY|
                    RAIL_EVENT_RX_ADDRESS_FILTERED|
                    RAIL_EVENT_RX_FIFO_OVERFLOW|
                    RAIL_EVENT_RX_FRAME_ERROR,
                    RAIL_EVENT_TX_CCA_RETRY|
                    RAIL_EVENT_TX_ABORTED|
                    RAIL_EVENT_TX_BLOCKED|
                    RAIL_EVENT_TX_BLOCKED_TOO_HOT|
                    RAIL_EVENT_TX_SCHEDULED_TX_MISSED|
                    RAIL_EVENT_TX_UNDERFLOW|
                    RAIL_EVENT_TX_CHANNEL_BUSY|
                    RAIL_EVENT_RX_ADDRESS_FILTERED|
                    RAIL_EVENT_RX_FIFO_OVERFLOW|
                    RAIL_EVENT_RX_FRAME_ERROR);

  while (1) {
    // Silicon Labs components process action routine
    // must be called from the super loop.
    sl_main_process_action();

    // User provided code. Application process.
    app_process_action();

#if defined(SL_CATALOG_POWER_MANAGER_PRESENT)
    // Let the CPU go to sleep if the system allows it.
    sl_power_manager_sleep();
#endif
  }
#endif // SL_CATALOG_KERNEL_PRESENT
}
